import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer } from "../server/index.mjs";

async function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p0-health-cors-"));
  const service = createServer({
    host: "127.0.0.1",
    port: 0,
    dbPath: path.join(dir, "api.sqlite"),
    webOrigins: "https://app.example.test",
    supabaseUrl: "https://auth.example.test",
    supabaseAnonKey: "synthetic-public-key",
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

test("P0 public health response is minimal and not cacheable", async () => {
  const app = await fixture();
  try {
    const response = await fetch(`${app.base}/health`, {
      headers: { Origin: "https://app.example.test" },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok" });
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("access-control-allow-origin"), "https://app.example.test");
  } finally {
    await app.close();
  }
});

test("P0 CORS preflight allows only configured origin and supported API methods/headers", async () => {
  const app = await fixture();
  try {
    const allowed = await fetch(`${app.base}/api/v1/supply/sites/site-a/assignments/user-a`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://app.example.test",
        "Access-Control-Request-Method": "DELETE",
        "Access-Control-Request-Headers": "authorization,content-type,x-active-tenant-id",
      },
    });
    assert.equal(allowed.status, 204);
    assert.equal(allowed.headers.get("access-control-allow-origin"), "https://app.example.test");
    const methods = (allowed.headers.get("access-control-allow-methods") ?? "").toLowerCase().split(",").map((v) => v.trim());
    const headers = (allowed.headers.get("access-control-allow-headers") ?? "").toLowerCase().split(",").map((v) => v.trim());
    for (const method of ["get", "post", "patch", "delete", "options"]) assert.ok(methods.includes(method), `missing CORS method ${method}`);
    for (const header of ["authorization", "content-type", "x-active-tenant-id"]) assert.ok(headers.includes(header), `missing CORS header ${header}`);

    const denied = await fetch(`${app.base}/api/v1/supply/sites/site-a/assignments/user-a`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://untrusted.example.test",
        "Access-Control-Request-Method": "DELETE",
      },
    });
    assert.equal(denied.status, 403);
    assert.equal(denied.headers.get("access-control-allow-origin"), null);
  } finally {
    await app.close();
  }
});
