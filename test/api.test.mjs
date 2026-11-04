import assert from "node:assert/strict";
import test from "node:test";
import { createApiClient } from "../src/api-core.ts";

const apiBaseUrl = "https://api.example.test///";
const product = { id: "coffee-01", name: "Arabica Coffee", category: "Coffee", origin: "Indonesia", unit: "kg" };

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("getHealth accepts the minimal public liveness contract", async () => {
  const client = createApiClient(apiBaseUrl, async () => jsonResponse({ status: "ok" }));
  assert.deepEqual(await client.getHealth(), { status: "ok" });
});

test("getProducts requests the shared catalog and returns its data", async () => {
  let requestedUrl;
  const client = createApiClient(apiBaseUrl, async (url) => {
    requestedUrl = String(url);
    return jsonResponse({ data: [product] });
  });

  assert.deepEqual(await client.getProducts(), [product]);
  assert.equal(requestedUrl, "https://api.example.test/api/v1/products");
});

test("createInquiry posts JSON and returns the tracking code", async () => {
  let request;
  const result = { trackingCode: "ABCD1234", status: "received", createdAt: "2026-10-06T10:00:00.000Z" };
  const input = {
    customerName: "Export Client",
    customerEmail: "client@example.com",
    destinationCountry: "Japan",
    productId: product.id,
    quantity: 1200,
  };
  const client = createApiClient(apiBaseUrl, async (url, init) => {
    request = { url: String(url), init };
    return jsonResponse(result);
  });

  assert.deepEqual(await client.createInquiry(input), result);
  assert.equal(request.url, "https://api.example.test/api/v1/inquiries");
  assert.equal(request.init.method, "POST");
  assert.equal(request.init.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(request.init.body), input);
});

test("trackInquiry trims and URL-encodes the tracking code", async () => {
  let requestedUrl;
  const data = { status: "received", createdAt: "2026-10-06T10:00:00.000Z", productName: "Arabica Coffee" };
  const client = createApiClient(apiBaseUrl, async (url) => {
    requestedUrl = String(url);
    return jsonResponse({ data });
  });

  assert.deepEqual(await client.trackInquiry(" ab-12/ef "), data);
  assert.equal(requestedUrl, "https://api.example.test/api/v1/inquiries/AB-12%2FEF");
});

test("HTTP 429 returns the retry guidance even when the body is empty", async () => {
  const client = createApiClient(apiBaseUrl, async () => new Response(null, { status: 429 }));
  await assert.rejects(client.getProducts(), { message: "Batas permintaan tercapai. Coba lagi beberapa menit lagi." });
});

test("tracking not-found response gives a specific message", async () => {
  const client = createApiClient(apiBaseUrl, async () => jsonResponse({ error: "inquiry_not_found" }, 404));
  await assert.rejects(client.trackInquiry("NOPE"), { message: "Permintaan tidak ditemukan. Periksa kode pelacakan." });
});

test("missing product response gives a specific message", async () => {
  const client = createApiClient(apiBaseUrl, async () => jsonResponse({ error: "product_not_found" }, 404));
  await assert.rejects(client.createInquiry({
    customerName: "Export Client",
    customerEmail: "client@example.com",
    destinationCountry: "Japan",
    productId: "removed-product",
    quantity: 100,
  }), { message: "Produk ini sudah tidak tersedia." });
});

test("HTTP 400 returns input guidance", async () => {
  const client = createApiClient(apiBaseUrl, async () => jsonResponse({ error: "validation_failed" }, 400));
  await assert.rejects(client.getProducts(), { message: "Periksa kembali data yang dimasukkan." });
});

test("non-JSON server error returns a stable message instead of a JSON parse error", async () => {
  const client = createApiClient(apiBaseUrl, async () => new Response("<html>server error</html>", {
    status: 502,
    headers: { "content-type": "text/html" },
  }));
  await assert.rejects(client.getProducts(), { message: "API tidak dapat memproses permintaan. Pastikan server berjalan." });
});

test("network failure returns a connection message without leaking transport details", async () => {
  const client = createApiClient(apiBaseUrl, async () => { throw new Error("ECONNREFUSED 10.0.2.2:4000"); });
  await assert.rejects(client.getProducts(), { message: "Tidak dapat terhubung ke server. Periksa koneksi dan alamat API." });
});

test("successful but empty response is rejected as invalid API data", async () => {
  const client = createApiClient(apiBaseUrl, async () => new Response(null, { status: 200 }));
  await assert.rejects(client.getProducts(), { message: "API mengirim respons yang tidak valid." });
});
