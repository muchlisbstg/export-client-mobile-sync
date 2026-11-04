import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer } from "../server/index.mjs";

const protectedRequests = [
  ["GET", "/api/v1/auth/session"],
  ["GET", "/api/v1/enterprise/session"],
  ["GET", "/api/v1/admin/session"],
  ["GET", "/api/v1/transactions"],
  ["GET", "/api/v1/transactions/tx-missing"],
  ["POST", "/api/v1/transactions"],
  ["PATCH", "/api/v1/transactions/tx-missing/status"],
  ["POST", "/api/v1/sync/inquiries"],
  ["POST", "/api/v1/supply/sites"],
  ["POST", "/api/v1/supply/sites/site-a/assignments"],
  ["DELETE", "/api/v1/supply/sites/site-a/assignments/user-a"],
  ["POST", "/api/v1/supply/lots"],
  ["POST", "/api/v1/supply/lots/lot-a/inspections"],
  ["POST", "/api/v1/supply/processing"],
  ["POST", "/api/v1/supply/movements"],
  ["POST", "/api/v1/supply/evidence"],
  ["GET", "/api/v1/supply/stock?siteId=site-a"],
  ["GET", "/api/v1/supply/lots/lot-a/trace"],
  ["POST", "/api/v1/supply/handovers"],
  ["POST", "/api/v1/supply/handovers/handover-a/dispatch"],
  ["POST", "/api/v1/supply/handovers/handover-a/receive"],
  ["POST", "/api/v1/transactions/tx-missing/access-assignments"],
  ["DELETE", "/api/v1/transactions/tx-missing/access-assignments/user-a/supplier"],
  ["POST", "/api/v1/transactions/tx-missing/site-links"],
];

async function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p0-endpoint-matrix-"));
  const service = createServer({
    host: "127.0.0.1",
    port: 0,
    dbPath: path.join(dir, "api.sqlite"),
    singleEnterpriseId: "enterprise-test",
    supabaseUrl: "https://auth.example.test",
    supabaseAnonKey: "public-test-key",
    syncSecret: "0123456789abcdef0123456789abcdef",
    nodeId: "matrix-test-node",
    peers: [],
    authFetcher: async (_url, init) => {
      const token = init.headers.Authorization?.replace(/^Bearer /, "") ?? "";
      if (token === "invalid-token" || token === "expired-token") {
        return new Response("{}", { status: 401 });
      }
      return new Response(JSON.stringify({ id: "matrix-user" }), { status: 200 });
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

test("P0 endpoint matrix: every protected method/path rejects missing credentials", async () => {
  const app = await fixture();
  try {
    for (const [method, route] of protectedRequests) {
      const response = await fetch(app.base + route, { method });
      assert.equal(response.status, 401, `missing bearer must fail closed: ${method} ${route}`);
    }
  } finally {
    await app.close();
  }
});

test("P0 endpoint matrix: every protected method/path rejects invalid and expired credentials", async () => {
  const app = await fixture();
  try {
    for (const token of ["invalid-token", "expired-token"]) {
      for (const [method, route] of protectedRequests) {
        const response = await fetch(app.base + route, {
          method,
          headers: { Authorization: `Bearer ${token}` },
        });
        assert.equal(response.status, 401, `${token} must fail closed: ${method} ${route}`);
      }
    }
  } finally {
    await app.close();
  }
});

test("P0 endpoint matrix: public and retired endpoints retain their explicit contracts", async () => {
  const app = await fixture();
  try {
    const health = await fetch(app.base + "/health");
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: "ok" }, "public health must expose only the minimal liveness contract");
    assert.equal(health.headers.get("cache-control"), "no-store");
    assert.equal((await fetch(app.base + "/api/v1/products")).status, 200);
    assert.equal((await fetch(app.base + "/api/v1/inquiries", { method: "POST" })).status, 400);
    assert.equal((await fetch(app.base + "/api/v1/inquiries/AAAAAAAAAAAAAAAAAAAAAAAA")).status, 404);
    assert.equal((await fetch(app.base + "/api/v1/sync/tenants", { method: "POST" })).status, 410);
  } finally {
    await app.close();
  }
});
