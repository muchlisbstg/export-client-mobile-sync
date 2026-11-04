import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer } from "../server/index.mjs";

test("P0 CORS preflight permits only configured origins and supported API methods", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p0-cors-preflight-"));
  const service = createServer({
    host: "127.0.0.1",
    port: 0,
    dbPath: path.join(dir, "api.sqlite"),
    webOrigins: "https://app.example.test",
  });

  try {
    const started = await service.start();
    const base = `http://127.0.0.1:${started.port}`;

    for (const method of ["GET", "POST", "PATCH", "DELETE"]) {
      const response = await fetch(base + "/api/v1/preflight-contract", {
        method: "OPTIONS",
        headers: {
          Origin: "https://app.example.test",
          "Access-Control-Request-Method": method,
          "Access-Control-Request-Headers": "authorization,content-type,idempotency-key,x-active-tenant-id,x-request-id",
        },
      });
      assert.equal(response.status, 204, `preflight for ${method} must succeed for configured origin`);
      assert.equal(response.headers.get("access-control-allow-origin"), "https://app.example.test");
      const allowedMethods = response.headers.get("access-control-allow-methods") ?? "";
      assert.ok(allowedMethods.split(/,\s*/).includes(method), `${method} must be listed in Access-Control-Allow-Methods`);
      const allowedHeaders = response.headers.get("access-control-allow-headers") ?? "";
      assert.match(allowedHeaders.toLowerCase(), /authorization/);
      assert.match(allowedHeaders.toLowerCase(), /content-type/);
      assert.match(allowedHeaders.toLowerCase(), /idempotency-key/);
      assert.match(allowedHeaders.toLowerCase(), /x-active-tenant-id/);
      assert.match(allowedHeaders.toLowerCase(), /x-request-id/);
    }

    const denied = await fetch(base + "/api/v1/preflight-contract", {
      method: "OPTIONS",
      headers: {
        Origin: "https://untrusted.example.test",
        "Access-Control-Request-Method": "DELETE",
      },
    });
    assert.equal(denied.status, 403, "unconfigured origins must remain denied");
  } finally {
    await service.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
