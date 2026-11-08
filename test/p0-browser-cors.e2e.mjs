import assert from "node:assert/strict";
import test from "node:test";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer } from "../server/index.mjs";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ?? "playwright");

function startOriginServer() {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end("<!doctype html><html><body><main id='ready'>browser-cors-e2e</main></body></html>");
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        origin: `http://127.0.0.1:${address.port}`,
        close: () => new Promise((done, fail) => server.close((error) => error ? fail(error) : done())),
      });
    });
  });
}

test("real Chromium enforces allowed-origin preflight and actual CORS response", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p0-browser-cors-"));
  const origin = await startOriginServer();
  const api = createServer({
    host: "127.0.0.1",
    port: 0,
    dbPath: path.join(dir, "api.sqlite"),
    webOrigins: origin.origin,
  });
  let browser;
  try {
    const started = await api.start();
    const apiOrigin = `http://127.0.0.1:${started.port}`;
    browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
    const page = await browser.newPage();
    await page.goto(origin.origin, { waitUntil: "domcontentloaded" });
    const allowedMethods = [];
    let allowedActualHeaders = {};
    page.on("request", (request) => {
      if (request.url() === apiOrigin + "/health") allowedMethods.push(request.method());
    });
    page.on("response", (response) => {
      if (response.url() === apiOrigin + "/health" && response.request().method() === "GET") {
        allowedActualHeaders = response.headers();
      }
    });

    const allowed = await page.evaluate(async (url) => {
      const response = await fetch(url + "/health", {
        method: "GET",
        headers: { "X-Request-Id": "browser-e2e-allowed" },
      });
      return {
        status: response.status,
        body: await response.json(),
      };
    }, apiOrigin);
    assert.equal(allowed.status, 200);
    assert.deepEqual(allowed.body, { status: "ok" });
    assert.ok(allowedMethods.includes("OPTIONS"), "Chromium must issue a real CORS preflight");
    assert.ok(allowedMethods.includes("GET"), "Chromium must issue the actual API request");
    assert.equal(allowedActualHeaders["access-control-allow-origin"], origin.origin,
      "actual response must carry the exact allowed origin (verified from browser network response)");

    const hostile = await startOriginServer();
    try {
      await page.goto(hostile.origin, { waitUntil: "domcontentloaded" });
      const denied = await page.evaluate(async (url) => {
        try {
          const response = await fetch(url + "/health", {
            method: "GET",
            headers: { "X-Request-Id": "browser-e2e-hostile" },
          });
          return { resolved: true, status: response.status };
        } catch (error) {
          return { resolved: false, name: error?.name ?? "unknown" };
        }
      }, apiOrigin);
      assert.deepEqual(denied, { resolved: false, name: "TypeError" });
    } finally {
      await hostile.close();
    }
  } finally {
    if (browser) await browser.close();
    await api.close();
    await origin.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
