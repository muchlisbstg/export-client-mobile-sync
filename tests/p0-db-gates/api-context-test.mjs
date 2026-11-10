import assert from "node:assert/strict";
import express from "express";
import pg from "pg";
import { createSupabaseAuth } from "../../server/auth.mjs";

const { Pool } = pg;
const adminPool = new Pool({ connectionString: process.env.PG_ADMIN_URL, max: 1 });
const apiPool = new Pool({ connectionString: process.env.PG_API_URL, max: 1, statement_timeout: 2_000 });
const identities = new Map([
  ["test-token-user-a", "user-a"],
  ["test-token-user-b", "user-b"],
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

const auth = createSupabaseAuth({
  url: "https://auth.example.test",
  anonKey: "test-public-key",
  adminUserIds: [],
  fetcher: async (url, init) => {
    assert.equal(url, "https://auth.example.test/auth/v1/user");
    assert.equal(init.headers.apikey, "test-public-key");
    const match = /^Bearer\\s+([^\\s]+)$/i.exec(init.headers.Authorization ?? "");
    const userId = match ? identities.get(match[1]) : null;
    if (!userId) return new Response("{}", { status: 401 });
    // Test-only IdP response. Deliberately include user-editable role metadata:
    // production middleware must derive authorization from its server allowlist,
    // never from user_metadata.
    return new Response(JSON.stringify({
      id: userId,
      user_metadata: { role: "admin", enterprise_role: "enterprise_admin" },
    }), { status: 200 });
  },
});

function authenticate(req, res, next) {
  return auth.authenticate(req, res, () => {
    req.authIdentity = res.locals.authIdentity;
    return next();
  });
}

async function resolveMembership(req) {
  const requestedTenant = String(req.get("x-active-tenant-id") ?? "").trim();
  const membership = await adminPool.query(
    `SELECT tenant_id FROM tenant_memberships
     WHERE user_id=$1 AND status='active' AND ($2='' OR tenant_id=$2)
     ORDER BY tenant_id`,
    [req.authIdentity.id, requestedTenant],
  );
  if (membership.rowCount !== 1) {
    const error = new Error(membership.rowCount > 1 ? "tenant_selection_required" : "enterprise_access_denied");
    error.status = membership.rowCount > 1 ? 409 : 403;
    throw error;
  }
  return membership.rows[0].tenant_id;
}

async function withTenantContext(req, res, work) {
  let client;
  let inTransaction = false;
  try {
    const tenantId = await resolveMembership(req);
    client = await apiPool.connect();
    await client.query("BEGIN");
    inTransaction = true;
    await client.query(
      "SELECT set_config('app.tenant_id',$1,true), set_config('app.user_id',$2,true)",
      [tenantId, req.authIdentity.id],
    );
    const value = await work(client, tenantId);
    await client.query("COMMIT");
    inTransaction = false;
    return res.json(value);
  } catch (error) {
    if (client && inTransaction) {
      await client.query("ROLLBACK").catch(() => {});
      inTransaction = false;
    }
    const status = error?.status ?? (error?.code === "42501" ? 403 : 500);
    return res.status(status).json({
      error: status === 403 ? "enterprise_access_denied"
        : status === 409 ? "tenant_selection_required"
        : status === 500 ? "tenant_request_failed" : "request_denied",
    });
  } finally {
    client?.release();
  }
}

app.post("/api/v1/test/tenant-audit", authenticate, (req, res) =>
  withTenantContext(req, res, async (client, tenantId) => {
    const fault = String(req.query.fault ?? "");
    if (fault === "rollback") await client.query("SELECT 1/0");
    if (fault === "timeout") {
      await client.query("SELECT set_config('statement_timeout','50ms',true)");
      await client.query("SELECT pg_sleep(0.2)");
    }
    const visible = await client.query(
      "SELECT app_tenant() AS tenant_id, app_user() AS user_id, pg_backend_pid() AS backend_pid, id FROM audit_events ORDER BY id",
    );
    return {
      tenant_id: tenantId,
      body_tenant_ignored: req.body?.tenant_id !== tenantId,
      body_user_ignored: req.body?.user_id !== req.authIdentity.id,
      backend_pid: visible.rows[0]?.backend_pid ?? (await client.query("SELECT pg_backend_pid() AS pid")).rows[0].pid,
      visible_audit_ids: visible.rows.map((row) => row.id),
      context_user_id: visible.rows[0]?.user_id ?? req.authIdentity.id,
    };
  }),
);

app.post("/api/v1/test/assignment-action", authenticate, (req, res) =>
  withTenantContext(req, res, async (client) => {
    // Adversarial test endpoint: ordinary app_api must not self-grant privileged actions.
    await client.query(
      "INSERT INTO transaction_access_assignment_actions(assignment_id,action_code) VALUES($1,$2)",
      [String(req.body?.assignment_id ?? ""), String(req.body?.action_code ?? "")],
    );
    return { created: true };
  }),
);

app.get("/api/v1/test/admin", authenticate, auth.requireAdmin, (_req, res) => res.json({ ok: true }));

// Test-only probe. max:1 ensures this reuses the same app_api backend connection.
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
    "SELECT rolsuper, rolbypassrls, rolcreaterole FROM pg_roles WHERE rolname='app_api'",
  );
  assert.equal(role.rows[0]?.rolsuper, false);
  assert.equal(role.rows[0]?.rolbypassrls, false);
  assert.equal(role.rows[0]?.rolcreaterole, false);

  server = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, options = {}) => fetch(`${base}${path}`, options);
  const post = (path, token, body = {}, headers = {}) => request(path, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

  await record("API-001 unauthenticated request rejected", async () => {
    const response = await request("/api/v1/test/tenant-audit", { method: "POST" });
    assert.equal(response.status, 401);
  });

  await record("API-002 forged tenant selector rejected", async () => {
    const response = await post("/api/v1/test/tenant-audit", "test-token-user-a", {}, { "x-active-tenant-id": "tenant-b" });
    assert.equal(response.status, 403);
  });

  let successfulResponse;
  await record("API-003 tenant context derived from active membership, body tenant ignored", async () => {
    const response = await post("/api/v1/test/tenant-audit", "test-token-user-a", { tenant_id: "tenant-b" }, { "x-active-tenant-id": "tenant-a" });
    assert.equal(response.status, 200);
    successfulResponse = await response.json();
    assert.equal(successfulResponse.tenant_id, "tenant-a");
    assert.equal(successfulResponse.body_tenant_ignored, true);
    assert.equal(successfulResponse.context_user_id, "user-a");
    assert.deepEqual(successfulResponse.visible_audit_ids, ["audit-a"]);
  });

  await record("API-004 revoked membership denied", async () => {
    const response = await post("/api/v1/test/tenant-audit", "test-token-user-revoked", { tenant_id: "tenant-a" });
    assert.equal(response.status, 403);
  });

  await record("SEC-02-001 forged user identity in header, query and body ignored", async () => {
    const response = await post("/api/v1/test/tenant-audit?user_id=user-b&tenant_id=tenant-b", "test-token-user-a",
      { user_id: "user-b", tenant_id: "tenant-b", role: "enterprise_admin", membership_id: "member-b", participant_id: "part-b", site_id: "site-b", action_code: "goods.release" },
      { "x-user-id": "user-b", "x-authenticated-user-id": "user-b", "x-active-tenant-id": "tenant-a" });
    assert.equal(response.status, 200);
    const value = await response.json();
    assert.equal(value.context_user_id, "user-a");
    assert.equal(value.tenant_id, "tenant-a");
    assert.deepEqual(value.visible_audit_ids, ["audit-a"]);
  });

  await record("SEC-02-002 forged bearer token cannot select another identity", async () => {
    const response = await post("/api/v1/test/tenant-audit", "user-b", { user_id: "user-b" }, { "x-user-id": "user-b" });
    assert.equal(response.status, 401);
  });

  await record("SEC-02-003 valid user cannot select a tenant without active membership", async () => {
    const response = await post("/api/v1/test/tenant-audit", "test-token-user-b", { tenant_id: "tenant-a" }, { "x-active-tenant-id": "tenant-a" });
    assert.equal(response.status, 403);
  });

  await record("SEC-02-004 client role claims cannot grant admin privilege", async () => {
    const response = await post("/api/v1/test/admin", "test-token-user-a", { role: "admin", is_admin: true });
    assert.equal(response.status, 404); // POST is not registered; no client-controlled admin route exists.
    const read = await request("/api/v1/test/admin?role=admin", { headers: { authorization: "Bearer test-token-user-a", "x-role": "admin" } });
    assert.equal(read.status, 403);
  });

  await record("POOL-01-001 pooled connection clears transaction-local context after commit", async () => {
    assert.ok(successfulResponse?.backend_pid);
    const response = await request("/__test/pool-context");
    assert.equal(response.status, 200);
    const probe = await response.json();
    assert.equal(probe.backend_pid, successfulResponse.backend_pid);
    assert.equal(probe.tenant_id, null);
    assert.equal(probe.user_id, null);
    assert.equal(probe.visible_audit_count, 0);
  });

  await record("POOL-01-002 pooled connection clears context after rollback", async () => {
    const failed = await post("/api/v1/test/tenant-audit?fault=rollback", "test-token-user-a");
    assert.equal(failed.status, 500);
    const probe = await (await request("/__test/pool-context")).json();
    assert.equal(probe.tenant_id, null);
    assert.equal(probe.user_id, null);
    assert.equal(probe.visible_audit_count, 0);
  });

  await record("POOL-01-003 pooled connection clears context after statement timeout", async () => {
    const failed = await post("/api/v1/test/tenant-audit?fault=timeout", "test-token-user-a");
    assert.equal(failed.status, 500);
    const probe = await (await request("/__test/pool-context")).json();
    assert.equal(probe.tenant_id, null);
    assert.equal(probe.user_id, null);
    assert.equal(probe.visible_audit_count, 0);
  });

  await record("POOL-01-004 concurrent requests do not cross-contaminate tenant/user context", async () => {
    const [a, b] = await Promise.all([
      post("/api/v1/test/tenant-audit", "test-token-user-a", {}, { "x-active-tenant-id": "tenant-a" }),
      post("/api/v1/test/tenant-audit", "test-token-user-b", {}, { "x-active-tenant-id": "tenant-b" }),
    ]);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    const [av, bv] = await Promise.all([a.json(), b.json()]);
    assert.equal(av.context_user_id, "user-a");
    assert.equal(av.tenant_id, "tenant-a");
    assert.deepEqual(av.visible_audit_ids, ["audit-a"]);
    assert.equal(bv.context_user_id, "user-b");
    assert.equal(bv.tenant_id, "tenant-b");
    assert.deepEqual(bv.visible_audit_ids, ["audit-b"]);
    assert.equal(av.backend_pid, bv.backend_pid);
  });

  await record("SEC-02-005 ordinary API role cannot self-grant contract approval action", async () => {
    const response = await post("/api/v1/test/assignment-action", "test-token-user-a", {
      assignment_id: "assign-a", action_code: "contract.approve",
      user_id: "user-a", tenant_id: "tenant-a", role: "enterprise_admin",
    }, { "x-active-tenant-id": "tenant-a" });
    assert.equal(response.status, 403);
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

const failed = results.some((item) => item.status === "FAIL" && (item.id.startsWith("API-") || item.id.startsWith("POOL-") || item.id.startsWith("SEC-") || item.id === "API-SETUP"));
console.log(JSON.stringify({
  suite: "GH-09 / POOL-01 / SEC-02 disposable HTTP/API tenant-context boundary",
  scope: "test-only Express adapter; fixed synthetic identity map; disposable PostgreSQL fixture; not production PostgreSQL integration",
  results,
  passed: results.filter((item) => item.status === "PASS").length,
  failed: results.filter((item) => item.status === "FAIL").length,
  blocked: results.filter((item) => item.status === "BLOCKED").length,
}, null, 2));
if (failed) process.exitCode = 1;
