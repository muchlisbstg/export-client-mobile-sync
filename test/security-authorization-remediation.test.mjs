import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer } from "../server/index.mjs";

async function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p0-auth-remediation-"));
  const service = createServer({
    host: "127.0.0.1",
    port: 0,
    dbPath: path.join(dir, "api.sqlite"),
    singleEnterpriseId: "enterprise-test",
    supabaseUrl: "https://auth.example.test",
    supabaseAnonKey: "public-test-key",
    adminUserIds: ["explicit-admin-id"],
    authFetcher: async (_url, init) => {
      const token = init.headers.Authorization?.replace(/^Bearer /, "") ?? "";
      if (token === "expired-token" || token === "invalid-token") {
        return new Response("{}", { status: 401 });
      }
      if (token === "member-token") {
        return new Response(JSON.stringify({
          id: "ordinary-user-id",
          user_metadata: { role: "admin", enterprise_role: "enterprise_admin" },
        }), { status: 200 });
      }
      if (token === "admin-token") {
        return new Response(JSON.stringify({ id: "explicit-admin-id" }), { status: 200 });
      }
      return new Response("{}", { status: 401 });
    },
  });
  const started = await service.start();
  return {
    base: `http://127.0.0.1:${started.port}`,
    close: async () => {
      await service.close();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

test("P0: missing and invalid credentials fail closed across protected API surfaces", async () => {
  const app = await fixture();
  try {
    const protectedRequests = [
      ["GET", "/api/v1/auth/session"],
      ["GET", "/api/v1/enterprise/session"],
      ["GET", "/api/v1/admin/session"],
      ["GET", "/api/v1/transactions"],
      ["GET", "/api/v1/transactions/tx-not-present"],
      ["GET", "/api/v1/supply/stock?siteId=site-not-present"],
      ["POST", "/api/v1/supply/sites"],
      ["POST", "/api/v1/transactions/tx-not-present/access-assignments"],
      ["POST", "/api/v1/transactions/tx-not-present/site-links"],
    ];

    for (const [method, route] of protectedRequests) {
      const response = await fetch(app.base + route, { method });
      assert.equal(response.status, 401, `missing bearer token must be rejected: ${method} ${route}`);
    }

    for (const token of ["invalid-token", "expired-token"]) {
      for (const [method, route] of protectedRequests) {
        const response = await fetch(app.base + route, {
          method,
          headers: { Authorization: `Bearer ${token}` },
        });
        assert.equal(response.status, 401, `${token} must be rejected: ${method} ${route}`);
      }
    }
  } finally {
    await app.close();
  }
});

test("P0: user-editable metadata cannot grant enterprise-admin or platform-admin access", async () => {
  const app = await fixture();
  try {
    const response = await fetch(app.base + "/api/v1/admin/session", {
      headers: { Authorization: "Bearer member-token" },
    });
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: "admin_required" });
  } finally {
    await app.close();
  }
});

test("P0: only the server-side admin allowlist grants the admin session", async () => {
  const app = await fixture();
  try {
    const response = await fetch(app.base + "/api/v1/admin/session", {
      headers: { Authorization: "Bearer admin-token" },
    });
    assert.equal(response.status, 200);
  } finally {
    await app.close();
  }
});
