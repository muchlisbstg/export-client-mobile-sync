import assert from "node:assert/strict";
import express from "express";
import pg from "pg";

const { Pool } = pg;
const adminPool = new Pool({ connectionString: process.env.PG_ADMIN_URL, max: 1 });
const apiPool = new Pool({ connectionString: process.env.PG_API_URL, max: 1 });
const identities = new Map([
  ["test-token-user-a", "user-a"],
  ["test-token-user-revoked", "user-old"],
]);
const results = [];

function record(id, fn) {
  return fn().then(
    () => results.push({ id, status: "PASS" }),
    (error) => results.push({ id, status: "FAIL", error: error instanceof Error ? error.message : String(error) }),
  );
}

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "4kb" }));

function authenticate(req, res, next) {
  const match = /^Bearer\s+([^\s]+)$/i.exec(req.get("authorization") ?? "");
  const userId = match ? identities.get(match[1]) : null;
  if (!userId) return res.status(401).json({ error: "authentication_required" });
  req.authIdentity = Object.freeze({ id: userId });
  return next();
}

app.post("/api/v1/test/tenant-audit", authenticate, async (req, res) => {
  let client;
  let inTransaction = false;
  try {
    // Tenant is derived from authenticated identity + active membership.
    // Header is only a consistency selector; request body is never a context source.
    const membership = await adminPool.query(
      "SELECT tenant_id FROM tenant_memberships WHERE user_id=$1 AND status='active' ORDER BY tenant_id LIMIT 1",
      [req.authIdentity.id],
    );
    if (membership.rowCount !== 1) return res.status(403).json({ error: "enterprise_access_denied" });
    const tenantId = membership.rows[0].tenant_id;
    const requestedTenant = String(req.get("x-active-tenant-id") ?? "").trim();
    if (requestedTenant && requestedTenant !== tenantId) {
      return res.status(403).json({ error: "tenant_context_mismatch" });
    }

    client = await apiPool.connect();
    await client.query("BEGIN");
    inTransaction = true;
    await client.query(
      "SELECT set_config('app.tenant_id',$1,true), set_config('app.user_id',$2,true)",
      [tenantId, req.authIdentity.id],
    );
    const visible = await client.query(
      "SELECT app_tenant() AS tenant_id, app_user() AS user_id, pg_backend_pid() AS backend_pid, id FROM audit_events ORDER BY id",
    );
    await client.query("COMMIT");
    inTransaction = false;
    return res.json({
      tenant_id: tenantId,
      body_tenant_ignored: req.body?.tenant_id !== tenantId,
      backend_pid: visible.rows[0]?.backend_pid ?? null,
      visible_audit_ids: visible.rows.map((row) => row.id),
      context_user_id: visible.rows[0]?.user_id ?? null,
    });
  } catch {
    if (client && inTransaction) await client.query("ROLLBACK").catch(() => {});
    return res.status(500).json({ error: "tenant_request_failed" });
  } finally {
    client?.release();
  }
});

// Test-only probe: reuses the single pooled app_api connection after the prior request.
app.get("/__test/pool-context", async (_req, res) => {
  try {
    const result = await apiPool.query(
      "SELECT app_tenant() AS tenant_id, app_user() AS user_id, pg_backend_pid() AS backend_pid, count(*)::int AS visible_audit_count FROM audit_events",
    );
    return res.json(result.rows[0]);
  } catch {
    return res.status(500).json({ error: "pool_probe_failed" });
  }
});

let server;
try {
  const role = await adminPool.query(
    "SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname='app_api'",
  );
  assert.equal(role.rows[0]?.rolsuper, false);
  assert.equal(role.rows[0]?.rolbypassrls, false);

  server = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, options = {}) => fetch(`${base}${path}`, options);

  await record("API-001 unauthenticated request rejected", async () => {
    const response = await request("/api/v1/test/tenant-audit", { method: "POST" });
    assert.equal(response.status, 401);
  });

  await record("API-002 forged tenant header rejected", async () => {
    const response = await request("/api/v1/test/tenant-audit", {
      method: "POST",
      headers: { authorization: "Bearer test-token-user-a", "content-type": "application/json", "x-active-tenant-id": "tenant-b" },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 403);
  });

  let successfulResponse;
  await record("API-003 context derived from active membership, not request body", async () => {
    const response = await request("/api/v1/test/tenant-audit", {
      method: "POST",
      headers: { authorization: "Bearer test-token-user-a", "content-type": "application/json", "x-active-tenant-id": "tenant-a" },
      body: JSON.stringify({ tenant_id: "tenant-b" }),
    });
    assert.equal(response.status, 200);
    successfulResponse = await response.json();
    assert.equal(successfulResponse.tenant_id, "tenant-a");
    assert.equal(successfulResponse.body_tenant_ignored, true);
    assert.equal(successfulResponse.context_user_id, "user-a");
    assert.deepEqual(successfulResponse.visible_audit_ids, ["audit-a"]);
  });

  await record("API-004 revoked membership denied", async () => {
    const response = await request("/api/v1/test/tenant-audit", {
      method: "POST",
      headers: { authorization: "Bearer test-token-user-revoked", "content-type": "application/json" },
      body: JSON.stringify({ tenant_id: "tenant-a" }),
    });
    assert.equal(response.status, 403);
  });

  await record("API-005 pooled connection has no tenant context after commit", async () => {
    assert.ok(successfulResponse?.backend_pid);
    const response = await request("/__test/pool-context");
    assert.equal(response.status, 200);
    const probe = await response.json();
    assert.equal(probe.backend_pid, successfulResponse.backend_pid);
    assert.equal(probe.tenant_id, null);
    assert.equal(probe.user_id, null);
    assert.equal(probe.visible_audit_count, 0);
  });

  const apiPassed = results.every((item) => item.status === "PASS");
  results.push(apiPassed
    ? { id: "RLS-016", status: "BLOCKED", reason: "The HTTP adapter is a disposable test harness, not the repository production server. Production server currently uses SQLite and has no PostgreSQL pool/context integration; DEC-006 cannot be cleared by this adapter-only evidence." }
    : { id: "RLS-016", status: "BLOCKED", reason: "One or more API trust-boundary or pool-reset assertions did not pass." });
} catch (error) {
  results.push({ id: "API-SETUP", status: "FAIL", error: error instanceof Error ? error.message : String(error) });
  results.push({ id: "RLS-016", status: "BLOCKED", reason: "API test setup failed; trust-boundary evidence is unavailable." });
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  await apiPool.end();
  await adminPool.end();
}

const failed = results.some((item) => item.status === "FAIL" && (item.id.startsWith("API-") || item.id === "API-SETUP"));
console.log(JSON.stringify({
  suite: "GH-09 disposable HTTP/API tenant-context boundary",
  scope: "test-only Express adapter; PostgreSQL disposable fixture; not production PostgreSQL integration",
  results,
  passed: results.filter((item) => item.status === "PASS").length,
  failed: results.filter((item) => item.status === "FAIL").length,
  blocked: results.filter((item) => item.status === "BLOCKED").length,
}, null, 2));
if (failed) process.exitCode = 1;
