import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer } from "../server/index.mjs";

const allowedOrigin = "https://app.example.test";
const allowedHeaders = [
  "authorization",
  "content-type",
  "idempotency-key",
  "x-active-tenant-id",
  "x-request-id",
  "x-sync-peer",
];

async function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cors-preflight-"));
  const service = createServer({
    host: "127.0.0.1",
    port: 0,
    dbPath: path.join(dir, "api.sqlite"),
    webOrigins: allowedOrigin,
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

test("CORS preflight allows supported API methods and required application headers", async () => {
  const app = await fixture();
  try {
    for (const method of ["GET", "POST", "PATCH", "DELETE"]) {
      const response = await fetch(app.base + "/api/v1/transactions/tx-1", {
        method: "OPTIONS",
        headers: {
          Origin: allowedOrigin,
          "Access-Control-Request-Method": method,
          "Access-Control-Request-Headers": allowedHeaders.join(", "),
        },
      });
      assert.equal(response.status, 204, `preflight must allow ${method}`);
      assert.equal(response.headers.get("access-control-allow-origin"), allowedOrigin);
      const methods = new Set((response.headers.get("access-control-allow-methods") ?? "").split(",").map((x) => x.trim()));
      assert.ok(methods.has(method), `preflight must advertise ${method}`);
      const headers = new Set((response.headers.get("access-control-allow-headers") ?? "").toLowerCase().split(",").map((x) => x.trim()));
      for (const header of allowedHeaders) assert.ok(headers.has(header), `preflight must advertise ${header}`);
      assert.match(response.headers.get("vary") ?? "", /Origin/i);
      assert.match(response.headers.get("vary") ?? "", /Access-Control-Request-Method/i);
      assert.match(response.headers.get("vary") ?? "", /Access-Control-Request-Headers/i);
      assert.equal(response.headers.get("access-control-max-age"), "600");
      assert.equal(response.headers.get("access-control-allow-credentials"), null);
    }
  } finally {
    await app.close();
  }
});

test("CORS preflight rejects methods outside the explicit allowlist", async () => {
  const app = await fixture();
  try {
    const response = await fetch(app.base + "/api/v1/transactions", {
      method: "OPTIONS",
      headers: {
        Origin: allowedOrigin,
        "Access-Control-Request-Method": "TRACE",
      },
    });
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: "cors_method_not_allowed" });
  } finally {
    await app.close();
  }
});

test("CORS preflight rejects unapproved request headers", async () => {
  const app = await fixture();
  try {
    const response = await fetch(app.base + "/api/v1/transactions", {
      method: "OPTIONS",
      headers: {
        Origin: allowedOrigin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization,x-untrusted-header",
      },
    });
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: "cors_header_not_allowed" });
  } finally {
    await app.close();
  }
});

test("CORS rejects origins that are not explicitly configured", async () => {
  const app = await fixture();
  try {
    const response = await fetch(app.base + "/health", {
      headers: { Origin: "https://attacker.example.test" },
    });
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: "origin_not_allowed" });
    assert.equal(response.headers.get("access-control-allow-origin"), null);
  } finally {
    await app.close();
  }
});
