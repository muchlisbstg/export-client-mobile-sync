import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer, parsePeers } from "../server/index.mjs";
import { migrateTenantIsolation } from "../scripts/migrate-tenant-isolation.mjs";

const tempDirs = [];
const services = [];
const secret = "test-sync-secret-that-is-at-least-32-characters";

afterEach(async () => {
  while (services.length) await services.pop().close();
  while (tempDirs.length) fs.rmSync(tempDirs.pop(), { recursive: true, force: true });
});

async function freePort() {
  const { createServer: createNetServer } = await import("node:net");
  const netServer = createNetServer();
  netServer.listen(0, "127.0.0.1");
  await new Promise((resolve) => netServer.once("listening", resolve));
  const port = netServer.address().port;
  await new Promise((resolve) => netServer.close(resolve));
  return port;
}

async function boot({ nodeId = "mobile-off", port = 0, syncSecret = "", syncPeers = "", supabaseUrl = "https://auth.example.test", supabaseAnonKey = "test-anon-key", authFetcher = async (_url, init) => {
  const token = init.headers.Authorization.replace(/^Bearer /, "");
  const ids = { "buyer-token": "buyer-admin", "seller-token": "seller-admin", "member-token": "buyer-member", "outsider-token": "outsider" };
  return new Response(JSON.stringify({ id: ids[token] ?? "unknown-user" }), { status: token === "expired" ? 401 : 200 });
} } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "export-mobile-api-"));
  tempDirs.push(directory);
  const service = createServer({ host: "127.0.0.1", port, nodeId, syncSecret, syncPeers, supabaseUrl, supabaseAnonKey, authFetcher, dbPath: path.join(directory, "api.sqlite") });
  const started = await service.start();
  services.push(service);
  return { service, base: `http://127.0.0.1:${started.port}` };
}

async function waitForTracking(base, code) {
  for (let attempt = 0; attempt < 70; attempt += 1) {
    const response = await fetch(`${base}/api/v1/inquiries/${code}`);
    if (response.ok) return response.json();
    assert.equal(response.status, 404);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Inquiry ${code} did not replicate to ${base}`);
}

async function waitForOutboxState(db, inquiryId, peerNodeId, condition, expectedState) {
  const find = db.prepare("SELECT attempt_count AS attemptCount FROM sync_outbox WHERE inquiry_id=? AND peer_node_id=?");
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const row = find.get(inquiryId, peerNodeId);
    if (condition(row)) return row;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Outbox did not reach ${expectedState} for ${inquiryId} -> ${peerNodeId}`);
}

test("HTTP IPv6 loopback peers are accepted for local development", () => {
  assert.deepEqual(parsePeers("web-peer=http://[::1]:4000", "mobile-local"), [
    { nodeId: "web-peer", baseUrl: "http://[::1]:4000" },
  ]);
});

test("health, catalog, create and tracking match the shared API contract", async () => {
  const { base } = await boot();
  const health = await (await fetch(`${base}/health`)).json();
  assert.deepEqual(health, {
    status: "ok", nodeId: "mobile-off", syncEnabled: false,
    syncStatus: { enabled: false, peerCount: 0, pendingDeliveries: 0, retryingDeliveries: 0, conflicts: 0 },
  });
  const catalog = await (await fetch(`${base}/api/v1/products`)).json();
  assert.deepEqual(catalog.data.map((product) => product.id), ["cocoa-beans", "green-coffee", "dried-spices"]);
  const createdResponse = await fetch(`${base}/api/v1/inquiries`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ customerName: "Demo Client", customerEmail: "demo@example.com", destinationCountry: "Japan", productId: "green-coffee", quantity: 100 }),
  });
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();
  assert.match(created.trackingCode, /^[A-F0-9]{24}$/);
  const tracked = await (await fetch(`${base}/api/v1/inquiries/${created.trackingCode}`)).json();
  assert.deepEqual(tracked.data, { status: "received", createdAt: created.createdAt, productName: "Kopi Arabika hijau" });
  assert.equal("customerEmail" in tracked.data, false);
});

test("JSON parser errors use stable 400 and 413 responses", async () => {
  const { base } = await boot();
  const malformed = await fetch(`${base}/api/v1/inquiries`, {
    method: "POST", headers: { "content-type": "application/json" }, body: '{"customerName":',
  });
  assert.equal(malformed.status, 400);
  assert.deepEqual(await malformed.json(), { error: "invalid_json" });

  const oversized = await fetch(`${base}/api/v1/inquiries`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ padding: "x".repeat(17 * 1024) }),
  });
  assert.equal(oversized.status, 413);
  assert.deepEqual(await oversized.json(), { error: "payload_too_large" });
});

test("sync is off by default and rejects unauthenticated or malformed peer records", async () => {
  const { base } = await boot();
  const disabled = await fetch(`${base}/api/v1/sync/inquiries`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  assert.equal(disabled.status, 503);

  const enabled = await boot({ nodeId: "mobile-auth", syncSecret: secret });
  const unauthorized = await fetch(`${enabled.base}/api/v1/sync/inquiries`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  assert.equal(unauthorized.status, 401);
  const malformed = await fetch(`${enabled.base}/api/v1/sync/inquiries`, {
    method: "POST", headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" }, body: "{}",
  });
  assert.equal(malformed.status, 400);
});

test("outbound replication waits for both a secret and a configured peer", async () => {
  const peerPort = await freePort();
  const partialConfigurations = [
    { nodeId: "mobile-secret-only", syncSecret: secret },
    { nodeId: "mobile-peers-only", syncPeers: `mobile-target=http://127.0.0.1:${peerPort}` },
  ];

  for (const options of partialConfigurations) {
    const { base, service } = await boot(options);
    const created = await fetch(`${base}/api/v1/inquiries`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ customerName: "Partial Config Client", customerEmail: "partial@example.com", destinationCountry: "Japan", productId: "green-coffee", quantity: 50 }),
    });
    assert.equal(created.status, 201);
    const { count } = service.db.prepare("SELECT COUNT(*) AS count FROM sync_outbox").get();
    assert.equal(count, 0, `${options.nodeId} must not queue outbound sync with partial configuration`);
  }
});

test("persistent outbox resumes sync after the peer returns and the node restarts", async () => {
  const sourcePort = await freePort();
  const targetPort = await freePort();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "export-mobile-recovery-"));
  tempDirs.push(directory);
  const sourceDbPath = path.join(directory, "source.sqlite");
  const peerNodeId = "mobile-recovery-target";
  const syncPeers = `${peerNodeId}=http://127.0.0.1:${targetPort}`;
  const sourceOptions = {
    host: "127.0.0.1",
    port: sourcePort,
    nodeId: "mobile-recovery-source",
    syncSecret: secret,
    syncPeers,
    dbPath: sourceDbPath,
  };
  const firstSource = createServer(sourceOptions);
  services.push(firstSource);
  const firstStarted = await firstSource.start();
  const firstBase = `http://127.0.0.1:${firstStarted.port}`;
  const createdResponse = await fetch(`${firstBase}/api/v1/inquiries`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ customerName: "Recovery Client", customerEmail: "recovery@example.test", destinationCountry: "Japan", productId: "green-coffee", quantity: 5 }),
  });
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();
  const sourceRecord = firstSource.db.prepare("SELECT id FROM inquiries WHERE tracking_code=?").get(created.trackingCode);
  assert(sourceRecord);
  const failedAttempt = await waitForOutboxState(firstSource.db, sourceRecord.id, peerNodeId, (row) => row?.attemptCount >= 1, "a persisted failed attempt");
  assert.ok(failedAttempt.attemptCount >= 1);
  const pendingStatus = await (await fetch(`${firstBase}/health`)).json();
  assert.deepEqual(pendingStatus.syncStatus, { enabled: true, peerCount: 1, pendingDeliveries: 1, retryingDeliveries: 1, conflicts: 0 });
  assert.equal("peerUrl" in pendingStatus.syncStatus, false);
  assert.equal("lastError" in pendingStatus.syncStatus, false);

  await firstSource.close();
  services.splice(services.indexOf(firstSource), 1);
  const target = await boot({ nodeId: peerNodeId, port: targetPort, syncSecret: secret });
  const restartedSource = createServer(sourceOptions);
  services.push(restartedSource);
  await restartedSource.start();
  const replicated = await waitForTracking(target.base, created.trackingCode);
  assert.equal(replicated.data.productName, "Kopi Arabika hijau");
  await waitForOutboxState(restartedSource.db, sourceRecord.id, peerNodeId, (row) => !row, "successful delivery and outbox removal");
  const recoveredStatus = await (await fetch(`${firstBase}/health`)).json();
  assert.equal(recoveredStatus.syncStatus.pendingDeliveries, 0);
});

test("three-node sync forwards inquiries transitively and stops duplicate echoes", async () => {
  const portA = await freePort();
  const portB = await freePort();
  const portC = await freePort();
  const nodeA = await boot({
    nodeId: "mobile-hop-a",
    port: portA,
    syncSecret: secret,
    syncPeers: `mobile-hop-b=http://127.0.0.1:${portB}`,
  });
  const nodeB = await boot({
    nodeId: "mobile-hop-b",
    port: portB,
    syncSecret: secret,
    syncPeers: `mobile-hop-a=http://127.0.0.1:${portA},mobile-hop-c=http://127.0.0.1:${portC}`,
  });
  const nodeC = await boot({
    nodeId: "mobile-hop-c",
    port: portC,
    syncSecret: secret,
    syncPeers: `mobile-hop-b=http://127.0.0.1:${portB}`,
  });

  const createdResponse = await fetch(`${nodeA.base}/api/v1/inquiries`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ customerName: "Three Node Client", customerEmail: "three-node@example.test", destinationCountry: "Japan", productId: "green-coffee", quantity: 8 }),
  });
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();
  const sourceRecord = nodeA.service.db.prepare("SELECT id FROM inquiries WHERE tracking_code=?").get(created.trackingCode);
  assert(sourceRecord);

  const atB = await waitForTracking(nodeB.base, created.trackingCode);
  const atC = await waitForTracking(nodeC.base, created.trackingCode);
  assert.equal(atB.data.productName, "Kopi Arabika hijau");
  assert.equal(atC.data.productName, "Kopi Arabika hijau");

  await waitForOutboxState(nodeA.service.db, sourceRecord.id, "mobile-hop-b", (row) => !row, "delivery to middle peer");
  await waitForOutboxState(nodeB.service.db, sourceRecord.id, "mobile-hop-c", (row) => !row, "forwarding to final peer");
  await waitForOutboxState(nodeC.service.db, sourceRecord.id, "mobile-hop-b", (row) => !row, "duplicate echo acknowledgement");

  for (const [label, node] of [["A", nodeA], ["B", nodeB], ["C", nodeC]]) {
    const stored = node.service.db.prepare("SELECT COUNT(*) AS count, MIN(origin_node_id) AS originNodeId FROM inquiries WHERE id=?").get(sourceRecord.id);
    assert.equal(stored.count, 1, `node ${label} must store exactly one copy`);
    assert.equal(stored.originNodeId, "mobile-hop-a", `node ${label} must preserve the origin node ID`);
    assert.equal(node.service.db.prepare("SELECT COUNT(*) AS count FROM sync_outbox WHERE inquiry_id=?").get(sourceRecord.id).count, 0, `node ${label} outbox must drain`);
    assert.equal(node.service.db.prepare("SELECT COUNT(*) AS count FROM sync_conflicts WHERE inquiry_id=?").get(sourceRecord.id).count, 0, `node ${label} must not record a conflict`);
  }
});

test("peer replication is idempotent and conflicts never overwrite stored data", async () => {
  const portA = await freePort();
  const portB = await freePort();
  const nodeA = await boot({ nodeId: "mobile-a", port: portA, syncSecret: secret, syncPeers: `mobile-b=http://127.0.0.1:${portB}` });
  const nodeB = await boot({ nodeId: "mobile-b", port: portB, syncSecret: secret, syncPeers: `mobile-a=http://127.0.0.1:${portA}` });
  const createdResponse = await fetch(`${nodeA.base}/api/v1/inquiries`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ customerName: "Peer Client", customerEmail: "peer@example.com", destinationCountry: "Japan", productId: "green-coffee", quantity: 12 }),
  });
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();
  const replicated = await waitForTracking(nodeB.base, created.trackingCode);
  assert.equal(replicated.data.productName, "Kopi Arabika hijau");

  const record = nodeA.service.db.prepare(`SELECT id,tracking_code AS trackingCode,customer_name AS customerName,
    customer_email AS customerEmail,destination_country AS destinationCountry,product_id AS productId,
    quantity,unit,status,created_at AS createdAt,origin_node_id AS originNodeId FROM inquiries WHERE tracking_code=?`).get(created.trackingCode);
  assert(record);
  const send = (payload) => fetch(`${nodeB.base}/api/v1/sync/inquiries`, {
    method: "POST", headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" }, body: JSON.stringify(payload),
  });
  const wrongUnit = await send({ ...record, id: "22222222-2222-4222-8222-222222222222", trackingCode: "B".repeat(24), unit: "piece" });
  assert.equal(wrongUnit.status, 404);
  const duplicate = await send(record);
  assert.equal(duplicate.status, 200);
  assert.equal((await duplicate.json()).result, "duplicate");

  const conflict = await send({ ...record, customerName: "Different Payload" });
  assert.equal(conflict.status, 409);
  const conflictBody = await conflict.json();
  assert.equal(conflictBody.error, "sync_conflict");
  assert.match(conflictBody.existingHash, /^[a-f0-9]{64}$/);
  assert.match(conflictBody.incomingHash, /^[a-f0-9]{64}$/);
  const collisionId = "33333333-3333-4333-8333-333333333333";
  const codeCollision = await send({ ...record, id: collisionId, customerName: "Tracking Code Collision" });
  assert.equal(codeCollision.status, 409);
  const collisionBody = await codeCollision.json();
  assert.equal(collisionBody.error, "sync_conflict");
  assert.match(collisionBody.existingHash, /^[a-f0-9]{64}$/);
  assert.match(collisionBody.incomingHash, /^[a-f0-9]{64}$/);
  const collision = nodeB.service.db.prepare("SELECT reason FROM sync_conflicts WHERE inquiry_id=?").get(collisionId);
  assert.equal(collision.reason, "tracking_code_collision");
  assert.equal(nodeB.service.db.prepare("SELECT customer_name FROM inquiries WHERE id=?").get(record.id).customer_name, "Peer Client");
  assert.equal(nodeB.service.db.prepare("SELECT COUNT(*) AS count FROM sync_conflicts WHERE inquiry_id=?").get(record.id).count, 1);
  const syncStatus = await (await fetch(`${nodeB.base}/health`)).json();
  assert.equal(syncStatus.syncStatus.conflicts, 2);
  assert.equal(syncStatus.syncStatus.pendingDeliveries, 0);
});


test("tenant transaction reads and writes are scoped to verified active membership and role", async () => {
  const { base, service } = await boot();
  try {
    migrateTenantIsolation(service.db);
    const db = service.db;
    db.prepare("INSERT INTO tenants (id,tenant_type,display_name,created_at) VALUES (?,?,?,?)").run("buyer-a","buyer","Buyer A",now());
    db.prepare("INSERT INTO tenants (id,tenant_type,display_name,created_at) VALUES (?,?,?,?)").run("seller-a","seller","Seller A",now());
    db.prepare("INSERT INTO tenants (id,tenant_type,display_name,created_at) VALUES (?,?,?,?)").run("buyer-b","buyer","Buyer B",now());
    const membership = db.prepare("INSERT INTO tenant_memberships (tenant_id,user_id,role,status,created_at) VALUES (?,?,?,'active',?)");
    membership.run("buyer-a","buyer-admin","buyer_admin",now());
    membership.run("buyer-a","buyer-member","buyer_member",now());
    membership.run("seller-a","seller-admin","seller_admin",now());
    membership.run("buyer-b","outsider","buyer_admin",now());

    const headers = (token, tenantId) => ({ authorization: `Bearer ${token}`, "x-active-tenant-id": tenantId, "content-type": "application/json" });
    const unauthenticated = await fetch(`${base}/api/v1/transactions`, { headers: { "x-active-tenant-id": "buyer-a" } });
    assert.equal(unauthenticated.status, 401);

    const noTenant = await fetch(`${base}/api/v1/transactions`, { headers: { authorization: "Bearer buyer-token" } });
    assert.equal(noTenant.status, 400);

    const createdResponse = await fetch(`${base}/api/v1/transactions`, {
      method: "POST", headers: headers("buyer-token","buyer-a"),
      body: JSON.stringify({ buyerTenantId: "buyer-b", sellerTenantId: "seller-a" }),
    });
    assert.equal(createdResponse.status, 201);
    const created = (await createdResponse.json()).data;
    assert.equal(created.buyerTenantId, "buyer-a", "buyer tenant comes from verified membership, never request body");

    const buyerList = await fetch(`${base}/api/v1/transactions`, { headers: headers("buyer-token","buyer-a") });
    assert.equal((await buyerList.json()).data.length, 1);
    const wrongTenant = await fetch(`${base}/api/v1/transactions/${created.id}`, { headers: headers("outsider-token","buyer-b") });
    assert.equal(wrongTenant.status, 404);
    const forgedTenant = await fetch(`${base}/api/v1/transactions`, { headers: headers("outsider-token","buyer-a") });
    assert.equal(forgedTenant.status, 403);

    const buyerMemberWrite = await fetch(`${base}/api/v1/transactions/${created.id}/status`, {
      method: "PATCH", headers: headers("member-token","buyer-a"), body: JSON.stringify({ status: "cancelled" }),
    });
    assert.equal(buyerMemberWrite.status, 403);

    const sellerAccept = await fetch(`${base}/api/v1/transactions/${created.id}/status`, {
      method: "PATCH", headers: headers("seller-token","seller-a"), body: JSON.stringify({ status: "accepted" }),
    });
    assert.equal(sellerAccept.status, 200);
    const sellerFulfill = await fetch(`${base}/api/v1/transactions/${created.id}/status`, {
      method: "PATCH", headers: headers("seller-token","seller-a"), body: JSON.stringify({ status: "fulfilled" }),
    });
    assert.equal(sellerFulfill.status, 200);

    const sellerCannotCreate = await fetch(`${base}/api/v1/transactions`, {
      method: "POST", headers: headers("seller-token","seller-a"), body: JSON.stringify({ sellerTenantId: "seller-a" }),
    });
    assert.equal(sellerCannotCreate.status, 403);
    const fulfilledCannotBeCancelled = await fetch(`${base}/api/v1/transactions/${created.id}/status`, {
      method: "PATCH", headers: headers("buyer-token","buyer-a"), body: JSON.stringify({ status: "cancelled" }),
    });
    assert.equal(fulfilledCannotBeCancelled.status, 403);
  } finally {
    await service.close();
  }
});
