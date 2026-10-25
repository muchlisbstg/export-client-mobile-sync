import express from "express";
import Database from "better-sqlite3";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { createSupabaseAuth } from "./auth.mjs";
import { registerSupplyChainRoutes } from "./supply-chain-routes.mjs";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PRODUCTS = [
  { id: "green-coffee", name: "Kopi Arabika hijau", category: "Kopi", origin: "Indonesia", unit: "kg" },
  { id: "dried-spices", name: "Rempah kering pilihan", category: "Rempah", origin: "Indonesia", unit: "kg" },
  { id: "cocoa-beans", name: "Biji kakao fermentasi", category: "Kakao", origin: "Indonesia", unit: "kg" },
];
const recordKeys = ["id", "trackingCode", "customerName", "customerEmail", "destinationCountry", "productId", "quantity", "unit", "status", "createdAt", "originNodeId"];
const now = () => new Date().toISOString();
const normalizeRecord = (record) => Object.fromEntries(recordKeys.map((key) => [key, record[key]]));
const hashRecord = (record) => crypto.createHash("sha256").update(JSON.stringify(normalizeRecord(record))).digest("hex");

function loadEnv(file = path.join(process.cwd(), ".env.api")) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

function isLoopback(hostname) {
  return ["localhost", "127.0.0.1", "[::1]", "::1"].includes(hostname);
}

export function parsePeers(raw = "", localNodeId = "") {
  const peers = [];
  const seen = new Set();
  for (const entry of raw.split(",").map((part) => part.trim()).filter(Boolean)) {
    const separator = entry.indexOf("=");
    if (separator <= 0) throw new Error("SYNC_PEERS must use nodeId=http(s)://host:port");
    const nodeId = entry.slice(0, separator).trim();
    if (!/^[A-Za-z0-9._-]{1,80}$/.test(nodeId) || nodeId === localNodeId || seen.has(nodeId)) {
      throw new Error("SYNC_PEERS contains an invalid, duplicate, or self node ID");
    }
    let url;
    try { url = new URL(entry.slice(separator + 1).trim()); } catch { throw new Error(`Invalid SYNC_PEERS URL for ${nodeId}`); }
    if (!(url.protocol === "http:" || url.protocol === "https:") || url.username || url.password || url.search || url.hash) {
      throw new Error(`Peer URL for ${nodeId} must be HTTP(S) without credentials, query, or fragment`);
    }
    if (url.protocol === "http:" && !isLoopback(url.hostname)) throw new Error(`Peer ${nodeId} must use HTTPS outside loopback development`);
    seen.add(nodeId);
    peers.push({ nodeId, baseUrl: `${url.origin}${url.pathname.replace(/\/+$/, "")}` });
  }
  return peers;
}

function validRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (Object.keys(value).length !== recordKeys.length || Object.keys(value).some((key) => !recordKeys.includes(key))) return false;
  if (recordKeys.filter((key) => key !== "quantity").some((key) => typeof value[key] !== "string" || !value[key].trim())) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.id)
    && /^[A-F0-9]{24}$/.test(value.trackingCode)
    && value.customerName.length >= 2 && value.customerName.length <= 120
    && value.customerEmail.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.customerEmail)
    && value.destinationCountry.length >= 2 && value.destinationCountry.length <= 80
    && value.productId.length <= 80 && value.unit.length <= 20
    && Number.isFinite(value.quantity) && value.quantity > 0 && value.quantity <= 1_000_000
    && value.status === "received" && !Number.isNaN(Date.parse(value.createdAt))
    && /^[A-Za-z0-9._-]{1,80}$/.test(value.originNodeId);
}

function sameSecret(header, expected) {
  const prefix = "Bearer ";
  if (!header?.startsWith(prefix) || !expected) return false;
  const actual = Buffer.from(header.slice(prefix.length));
  const wanted = Buffer.from(expected);
  return actual.length === wanted.length && crypto.timingSafeEqual(actual, wanted);
}

function makeRateLimiter(limit) {
  const requests = new Map();
  return (req, res, next) => {
    const key = req.ip || req.socket.remoteAddress || "unknown";
    const current = requests.get(key);
    const time = Date.now();
    if (!current || current.resetAt <= time) requests.set(key, { count: 1, resetAt: time + 15 * 60_000 });
    else current.count += 1;
    const entry = requests.get(key);
    if (entry.count > limit) return res.status(429).json({ error: "rate_limit_exceeded" });
    return next();
  };
}

export function createServer(options = {}) {
  loadEnv(options.envFile);
  const port = Number(options.port ?? process.env.API_PORT ?? 4001);
  const host = options.host ?? process.env.API_HOST ?? "127.0.0.1";
  const dbPath = options.dbPath ?? process.env.API_DB_PATH ?? path.join(here, "data", "api.sqlite");
  const singleEnterpriseId = String(options.singleEnterpriseId ?? process.env.SINGLE_ENTERPRISE_ID ?? "").trim();
  fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, origin TEXT NOT NULL,
      unit TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS inquiries (
      id TEXT PRIMARY KEY, tracking_code TEXT NOT NULL UNIQUE, customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL, destination_country TEXT NOT NULL,
      product_id TEXT NOT NULL REFERENCES products(id), quantity REAL NOT NULL CHECK (quantity > 0),
      unit TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'received', created_at TEXT NOT NULL,
      origin_node_id TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sync_conflicts (
      conflict_id INTEGER PRIMARY KEY AUTOINCREMENT, inquiry_id TEXT NOT NULL, peer_node_id TEXT NOT NULL,
      existing_hash TEXT NOT NULL, incoming_hash TEXT NOT NULL, reason TEXT NOT NULL, detected_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sync_outbox (
      inquiry_id TEXT NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE, peer_node_id TEXT NOT NULL,
      peer_url TEXT NOT NULL, attempt_count INTEGER NOT NULL DEFAULT 0,
      next_attempt_at_ms INTEGER NOT NULL DEFAULT 0, last_error TEXT,
      PRIMARY KEY (inquiry_id, peer_node_id)
    );
  `);
  const productColumns = db.prepare("PRAGMA table_info(products)").all();
  if (!productColumns.some((column) => column.name === "active")) db.exec("ALTER TABLE products ADD COLUMN active INTEGER NOT NULL DEFAULT 1");
  const insertProduct = db.prepare("INSERT OR IGNORE INTO products (id,name,category,origin,unit) VALUES (@id,@name,@category,@origin,@unit)");
  for (const product of DEFAULT_PRODUCTS) insertProduct.run(product);

  const secret = String(options.syncSecret ?? process.env.SYNC_SHARED_SECRET ?? "").trim();
  const nodeIdWasSet = options.nodeId !== undefined || Boolean(process.env.SYNC_NODE_ID?.trim());
  const nodeId = String(options.nodeId ?? process.env.SYNC_NODE_ID ?? "mobile-local").trim();
  if (secret && secret.length < 32) throw new Error("SYNC_SHARED_SECRET must contain at least 32 characters");
  if (secret && !nodeIdWasSet) throw new Error("SYNC_NODE_ID is required when synchronization is enabled");
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(nodeId)) throw new Error("SYNC_NODE_ID is invalid");
  const peers = options.peers ?? parsePeers(options.syncPeers ?? process.env.SYNC_PEERS ?? "", nodeId);
  if (new Set(peers.map((peer) => peer.nodeId)).size !== peers.length || peers.some((peer) => peer.nodeId === nodeId)) {
    throw new Error("SYNC_PEERS node IDs must be unique and cannot include this node");
  }
  const syncEnabled = Boolean(secret);
  const app = express();
  app.disable("x-powered-by");

  const allowedOrigins = String(options.webOrigins ?? process.env.WEB_ORIGINS ?? "http://localhost:5173")
    .split(",").map((origin) => origin.trim()).filter(Boolean);
  app.use((req, res, next) => {
    const origin = req.get("origin");
    if (!origin) return next();
    if (!allowedOrigins.includes(origin)) return res.status(403).json({ error: "origin_not_allowed" });
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    return next();
  });
  app.use(express.json({ limit: "16kb" }));
  const createLimiter = makeRateLimiter(Number(process.env.RFQ_LIMIT_PER_15M) || 10);
  const trackLimiter = makeRateLimiter(Number(process.env.TRACK_LOOKUP_LIMIT_PER_15M) || 60);
  const authLimiter = makeRateLimiter(Number(process.env.AUTH_LIMIT_PER_15M) || 120);

  const selectRecord = `SELECT id, tracking_code AS trackingCode, customer_name AS customerName,
    customer_email AS customerEmail, destination_country AS destinationCountry,
    product_id AS productId, quantity, unit, status, created_at AS createdAt,
    origin_node_id AS originNodeId FROM inquiries WHERE id = ?`;
  const insertInquiry = db.prepare(`INSERT INTO inquiries
    (id,tracking_code,customer_name,customer_email,destination_country,product_id,quantity,unit,status,created_at,origin_node_id)
    VALUES (@id,@trackingCode,@customerName,@customerEmail,@destinationCountry,@productId,@quantity,@unit,@status,@createdAt,@originNodeId)`);
  const insertOutbox = db.prepare(`INSERT OR IGNORE INTO sync_outbox
    (inquiry_id,peer_node_id,peer_url,next_attempt_at_ms) VALUES (?,?,?,0)`);
  const fetcher = options.fetcher ?? fetch;
  let flushing = false;
  let timer;
  let listener;

  function queueRecord(record) {
    if (!secret || !peers.length) return;
    const transaction = db.transaction(() => {
      for (const peer of peers) {
        if (peer.nodeId === nodeId || peer.nodeId === record.originNodeId) continue;
        insertOutbox.run(record.id, peer.nodeId, peer.baseUrl);
      }
    });
    transaction();
    void flushOutbox();
  }

  function addConflict(record, existing, peerNodeId, reason) {
    const existingHash = hashRecord(existing);
    const incomingHash = hashRecord(record);
    db.prepare(`INSERT INTO sync_conflicts
      (inquiry_id,peer_node_id,existing_hash,incoming_hash,reason,detected_at) VALUES (?,?,?,?,?,?)`)
      .run(record.id, peerNodeId, existingHash, incomingHash, reason, now());
    return { existingHash, incomingHash };
  }

  function receiveRecord(record, peerNodeId = record.originNodeId) {
    const byId = db.prepare(selectRecord).get(record.id);
    const byCode = db.prepare(selectRecord.replace("WHERE id = ?", "WHERE tracking_code = ?")).get(record.trackingCode);
    const existing = byId ?? byCode;
    if (existing) {
      if (hashRecord(existing) === hashRecord(record)) return { result: "duplicate" };
      const hashes = addConflict(record, existing, peerNodeId, byId ? "record_mismatch" : "tracking_code_collision");
      return { result: "conflict", ...hashes };
    }
    const product = db.prepare("SELECT id,unit FROM products WHERE id = ? AND active = 1").get(record.productId);
    if (!product || product.unit !== record.unit) return { result: "product_not_found" };
    insertInquiry.run(record);
    queueRecord(record);
    return { result: "inserted" };
  }

  async function flushOutbox() {
    if (flushing || !secret || !peers.length) return;
    flushing = true;
    try {
      const items = db.prepare(`SELECT inquiry_id AS inquiryId, peer_node_id AS peerNodeId,
        peer_url AS peerUrl, attempt_count AS attemptCount FROM sync_outbox
        WHERE next_attempt_at_ms <= ? ORDER BY next_attempt_at_ms LIMIT 20`).all(Date.now());
      for (const item of items) {
        const record = db.prepare(selectRecord).get(item.inquiryId);
        if (!record) {
          db.prepare("DELETE FROM sync_outbox WHERE inquiry_id = ? AND peer_node_id = ?").run(item.inquiryId, item.peerNodeId);
          continue;
        }
        try {
          const response = await fetcher(`${item.peerUrl}/api/v1/sync/inquiries`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
            body: JSON.stringify(record),
            signal: AbortSignal.timeout(5_000),
          });
          if (response.ok) {
            db.prepare("DELETE FROM sync_outbox WHERE inquiry_id = ? AND peer_node_id = ?").run(item.inquiryId, item.peerNodeId);
          } else if (response.status === 409) {
            const body = await response.json().catch(() => ({}));
            db.prepare(`INSERT INTO sync_conflicts
              (inquiry_id,peer_node_id,existing_hash,incoming_hash,reason,detected_at) VALUES (?,?,?,?,?,?)`)
              .run(item.inquiryId, item.peerNodeId, body.existingHash ?? hashRecord(record), body.incomingHash ?? "unknown", "remote_conflict", now());
            db.prepare("DELETE FROM sync_outbox WHERE inquiry_id = ? AND peer_node_id = ?").run(item.inquiryId, item.peerNodeId);
          } else {
            throw new Error(`peer_http_${response.status}`);
          }
        } catch (error) {
          const attemptCount = item.attemptCount + 1;
          const delayMs = Math.min(300_000, 1_000 * 2 ** Math.min(attemptCount, 8));
          db.prepare(`UPDATE sync_outbox SET attempt_count = ?, next_attempt_at_ms = ?, last_error = ?
            WHERE inquiry_id = ? AND peer_node_id = ?`).run(
            attemptCount, Date.now() + delayMs,
            error instanceof Error ? error.message.slice(0, 120) : "sync_error",
            item.inquiryId, item.peerNodeId
          );
        }
      }
    } finally {
      flushing = false;
    }
  }

  const auth = createSupabaseAuth({
    url: options.supabaseUrl, anonKey: options.supabaseAnonKey,
    adminUserIds: options.adminUserIds, fetcher: options.authFetcher,
  });
  app.get("/api/v1/auth/session", authLimiter, auth.authenticate, (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    return res.json({ user: res.locals.authIdentity });
  });
  app.get("/api/v1/enterprise/session", authLimiter, auth.authenticate, (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (!singleEnterpriseId) return res.status(503).json({ error: "single_enterprise_not_configured" });
    if (!tenantSchemaReady()) return res.status(503).json({ error: "tenant_schema_not_ready" });
    const context = resolveEnterpriseMembership(res.locals.authIdentity.id);
    if (!context) return res.status(403).json({ error: "enterprise_access_denied" });
    return res.json({ enterprise: { id: context.id, displayName: context.displayName }, user: res.locals.authIdentity, roles: context.roles });
  });
  app.get("/api/v1/admin/session", authLimiter, auth.authenticate, auth.requireAdmin, (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    return res.json({ ok: true, user: res.locals.authIdentity });
  });

  app.get("/health", (_req, res) => {
    db.prepare("SELECT 1").get();
    const pendingDeliveries = db.prepare("SELECT COUNT(*) AS count FROM sync_outbox").get().count;
    const retryingDeliveries = db.prepare("SELECT COUNT(*) AS count FROM sync_outbox WHERE last_error IS NOT NULL").get().count;
    const conflicts = db.prepare("SELECT COUNT(*) AS count FROM sync_conflicts").get().count;
    res.setHeader("Cache-Control", "no-store");
    res.json({
      status: "ok",
      nodeId,
      syncEnabled,
      syncStatus: { enabled: syncEnabled, peerCount: peers.length, pendingDeliveries, retryingDeliveries, conflicts },
    });
  });


  function tenantSchemaReady() {
    const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((row) => row.name));
    if (!["tenants", "tenant_memberships", "enterprise_role_assignments", "commercial_transactions"].every((name) => tables.has(name))) return false;
    const columns = new Set(db.prepare("PRAGMA table_info(inquiries)").all().map((row) => row.name));
    return ["buyer_tenant_id", "seller_tenant_id", "tenant_migration_state"].every((name) => columns.has(name));
  }
  function resolveEnterpriseMembership(userId) {
    if (!singleEnterpriseId || !tenantSchemaReady()) return null;
    const membership = db.prepare(`SELECT t.id, t.tenant_type AS tenantType, t.display_name AS displayName,
      t.status AS tenantStatus, m.role AS legacyRole, m.status AS membershipStatus
      FROM tenants t JOIN tenant_memberships m ON m.tenant_id=t.id
      WHERE m.user_id=? AND t.id=?`).get(userId, singleEnterpriseId);
    if (!membership || membership.tenantStatus !== "active" || membership.membershipStatus !== "active") return null;
    const roles = db.prepare(`SELECT role FROM enterprise_role_assignments
      WHERE enterprise_id=? AND user_id=? AND status='active' ORDER BY role`).all(singleEnterpriseId, userId).map((row) => row.role);
    return { ...membership, role: roles[0] ?? null, roles };
  }
  function requireActiveTenant(req, res, next) {
    if (!tenantSchemaReady()) return res.status(503).json({ error: "tenant_schema_not_ready" });
    if (!singleEnterpriseId) return res.status(503).json({ error: "single_enterprise_not_configured" });
    const identity = res.locals.authIdentity;
    const requestedId = String(req.get("x-active-tenant-id") ?? "").trim();
    if (requestedId && requestedId !== singleEnterpriseId) return res.status(403).json({ error: "enterprise_context_locked" });
    const membership = identity ? resolveEnterpriseMembership(identity.id) : null;
    if (!membership) return res.status(403).json({ error: "enterprise_access_denied" });
    res.locals.activeTenant = membership;
    return next();
  }
  function requireEnterpriseRole(...allowedRoles) {
    return (_req, res, next) => {
      const roles = res.locals.activeTenant?.roles ?? [];
      if (!allowedRoles.some((role) => roles.includes(role))) return res.status(403).json({ error: "enterprise_role_forbidden" });
      return next();
    };
  }


  registerSupplyChainRoutes(app, { db, auth, requireActiveTenant, requireEnterpriseRole, authLimiter });

  function readTenantBundle(transactionId) {
    const transaction = db.prepare("SELECT id,buyer_tenant_id AS buyerTenantId,seller_tenant_id AS sellerTenantId,inquiry_id AS inquiryId,status,created_at AS createdAt FROM commercial_transactions WHERE id=?").get(transactionId);
    if (!transaction) return undefined;
    const tenants = db.prepare("SELECT id,tenant_type AS tenantType,display_name AS displayName,status,created_at AS createdAt FROM tenants WHERE id IN (?,?)").all(transaction.buyerTenantId,transaction.sellerTenantId);
    const memberships = db.prepare("SELECT tenant_id AS tenantId,user_id AS userId,role,status,created_at AS createdAt FROM tenant_memberships WHERE tenant_id IN (?,?)").all(transaction.buyerTenantId,transaction.sellerTenantId);
    return { transaction, tenants, memberships };
  }
  let tenantOutboxFlushing = false;
  function enqueueTenantBundle(transactionId) {
    if (!secret || !peers.length || !tenantSchemaReady()) return;
    const bundle = readTenantBundle(transactionId);
    if (!bundle) return;
    const enqueue = db.prepare("INSERT INTO tenant_sync_outbox (event_id,peer_node_id,peer_url,event_type,aggregate_id,payload_json,created_at) VALUES (?,?,?,?,?,?,?)");
    db.transaction(() => {
      for (const peer of peers) enqueue.run(crypto.randomUUID(),peer.nodeId,peer.baseUrl,"transaction.upsert",transactionId,JSON.stringify(bundle),now());
    })();
    void flushTenantOutbox();
  }
  async function flushTenantOutbox() {
    if (tenantOutboxFlushing || !secret || !tenantSchemaReady()) return;
    tenantOutboxFlushing = true;
    try {
      const due = db.prepare("SELECT event_id AS eventId,peer_node_id AS peerNodeId,peer_url AS peerUrl,payload_json AS payloadJson,attempt_count AS attemptCount FROM tenant_sync_outbox WHERE delivered_at IS NULL AND next_attempt_at_ms<=? AND NOT EXISTS (SELECT 1 FROM tenant_sync_outbox older WHERE older.peer_node_id=tenant_sync_outbox.peer_node_id AND older.aggregate_id=tenant_sync_outbox.aggregate_id AND older.delivered_at IS NULL AND older.queue_seq<tenant_sync_outbox.queue_seq) ORDER BY queue_seq LIMIT 20").all(Date.now());
      for (const item of due) {
        try {
          const result = await fetcher(`${item.peerUrl}/api/v1/sync/tenants`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${secret}`,"x-sync-peer":nodeId},body:JSON.stringify({eventId:item.eventId,eventType:"transaction.upsert",payload:JSON.parse(item.payloadJson)}),signal:AbortSignal.timeout(5000)});
          if (!result.ok) throw new Error(`peer_http_${result.status}`);
          db.prepare("UPDATE tenant_sync_outbox SET delivered_at=?,last_error=NULL WHERE event_id=? AND peer_node_id=?").run(now(),item.eventId,item.peerNodeId);
        } catch (error) {
          const attempts=item.attemptCount+1, delay=Math.min(300000,1000*2**Math.min(attempts,8));
          db.prepare("UPDATE tenant_sync_outbox SET attempt_count=?,next_attempt_at_ms=?,last_error=? WHERE event_id=? AND peer_node_id=?").run(attempts,Date.now()+delay,error instanceof Error?error.message.slice(0,120):"tenant_sync_error",item.eventId,item.peerNodeId);
        }
      }
    } finally { tenantOutboxFlushing=false; }
  }
  function validTenantBundle(value) {
    if (!value || typeof value!=="object") return false;
    const b=value;
    return Boolean(b.transaction && typeof b.transaction.id==="string" && typeof b.transaction.buyerTenantId==="string" && typeof b.transaction.sellerTenantId==="string"
      && ["pending","accepted","fulfilled","cancelled","disputed"].includes(b.transaction.status)
      && Array.isArray(b.tenants) && b.tenants.length===2 && b.tenants.every(t=>t && typeof t.id==="string" && ["buyer","seller"].includes(t.tenantType) && typeof t.displayName==="string" && ["active","suspended","archived"].includes(t.status) && typeof t.createdAt==="string")
      && Array.isArray(b.memberships) && b.memberships.every(m=>m && typeof m.tenantId==="string" && typeof m.userId==="string" && ["buyer_admin","buyer_member","seller_admin","seller_member"].includes(m.role) && ["active","suspended","revoked"].includes(m.status) && typeof m.createdAt==="string"));
  }
  // Multi-enterprise tenant bundle replication is retired in the single-enterprise model.
  app.post("/api/v1/sync/tenants", (_req,res) => res.status(410).json({error:"multi_enterprise_sync_retired"}));

  app.get("/api/v1/transactions", auth.authenticate, requireActiveTenant, (_req, res) => {
    const tenant = res.locals.activeTenant;
    const rows = db.prepare(`SELECT id, buyer_tenant_id AS buyerTenantId, seller_tenant_id AS sellerTenantId, inquiry_id AS inquiryId, status, created_at AS createdAt
      FROM commercial_transactions WHERE buyer_tenant_id=? OR seller_tenant_id=? ORDER BY created_at DESC LIMIT 100`).all(tenant.id, tenant.id);
    res.setHeader("Cache-Control", "no-store");
    return res.json({ data: rows });
  });
  app.get("/api/v1/transactions/:id", auth.authenticate, requireActiveTenant, (req, res) => {
    const tenant = res.locals.activeTenant;
    const row = db.prepare(`SELECT id, buyer_tenant_id AS buyerTenantId, seller_tenant_id AS sellerTenantId, inquiry_id AS inquiryId, status, created_at AS createdAt
      FROM commercial_transactions WHERE id=? AND (buyer_tenant_id=? OR seller_tenant_id=?)`).get(req.params.id, tenant.id, tenant.id);
    res.setHeader("Cache-Control", "no-store");
    if (!row) return res.status(404).json({ error: "transaction_not_found" });
    return res.json({ data: row });
  });
  // Legacy two-enterprise transaction writes are intentionally disabled. Buyer/Seller workflows
  // must be implemented as roles and orders within the configured single enterprise.
  app.post("/api/v1/transactions", auth.authenticate, requireActiveTenant, (_req,res) =>
    res.status(410).json({error:"single_enterprise_order_workflow_not_implemented"}));
  app.patch("/api/v1/transactions/:id/status", auth.authenticate, requireActiveTenant, (_req,res) =>
    res.status(410).json({error:"single_enterprise_order_workflow_not_implemented"}));

  app.get("/api/v1/products", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ data: db.prepare("SELECT id,name,category,origin,unit FROM products WHERE active = 1 ORDER BY name").all() });
  });

  app.post("/api/v1/inquiries", createLimiter, (req, res) => {
    const input = req.body ?? {};
    const customerName = typeof input.customerName === "string" ? input.customerName.trim() : "";
    const customerEmail = typeof input.customerEmail === "string" ? input.customerEmail.trim() : "";
    const destinationCountry = typeof input.destinationCountry === "string" ? input.destinationCountry.trim() : "";
    const productId = typeof input.productId === "string" ? input.productId.trim() : "";
    const quantity = Number(input.quantity);
    const valid = customerName.length >= 2 && customerName.length <= 120
      && customerEmail.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)
      && destinationCountry.length >= 2 && destinationCountry.length <= 80
      && productId.length > 0 && productId.length <= 80
      && Number.isFinite(quantity) && quantity > 0 && quantity <= 1_000_000;
    if (!valid) return res.status(400).json({ error: "invalid_request" });
    const product = db.prepare("SELECT id,unit FROM products WHERE id = ? AND active = 1").get(productId);
    if (!product) return res.status(404).json({ error: "product_not_found" });

    let trackingCode = "";
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = crypto.randomBytes(12).toString("hex").toUpperCase();
      if (!db.prepare("SELECT 1 FROM inquiries WHERE tracking_code = ?").get(candidate)) { trackingCode = candidate; break; }
    }
    if (!trackingCode) return res.status(503).json({ error: "tracking_code_unavailable" });
    const record = {
      id: crypto.randomUUID(), trackingCode, customerName, customerEmail, destinationCountry,
      productId, quantity, unit: product.unit, status: "received", createdAt: now(), originNodeId: nodeId,
    };
    insertInquiry.run(record);
    queueRecord(record);
    res.setHeader("Cache-Control", "no-store");
    return res.status(201).json({ trackingCode, status: record.status, createdAt: record.createdAt });
  });

  app.post("/api/v1/sync/inquiries", (req, res) => {
    if (!secret) return res.status(503).json({ error: "sync_disabled" });
    if (!sameSecret(req.get("authorization"), secret)) return res.status(401).json({ error: "unauthorized" });
    if (!validRecord(req.body)) return res.status(400).json({ error: "invalid_sync_record" });
    const result = receiveRecord(req.body, req.get("x-sync-peer") || req.body.originNodeId);
    if (result.result === "product_not_found") return res.status(404).json({ error: "product_not_found" });
    if (result.result === "conflict") return res.status(409).json({ error: "sync_conflict", ...result });
    return res.status(result.result === "inserted" ? 201 : 200).json({ result: result.result });
  });

  app.get("/api/v1/inquiries/:trackingCode", trackLimiter, (req, res) => {
    const code = String(req.params.trackingCode ?? "").trim().toUpperCase();
    if (!/^[A-F0-9]{24}$/.test(code)) return res.status(400).json({ error: "invalid_tracking_code" });
    const inquiry = db.prepare(`SELECT i.status, i.created_at AS createdAt, p.name AS productName
      FROM inquiries i JOIN products p ON p.id = i.product_id WHERE i.tracking_code = ?`).get(code);
    res.setHeader("Cache-Control", "no-store");
    if (!inquiry) return res.status(404).json({ error: "inquiry_not_found" });
    return res.json({ data: inquiry });
  });

  app.use((error, _req, res, _next) => {
    if (error?.type === "entity.parse.failed") return res.status(400).json({ error: "invalid_json" });
    if (error?.type === "entity.too.large") return res.status(413).json({ error: "payload_too_large" });
    return res.status(500).json({ error: "internal_server_error" });
  });

  async function start() {
    if (secret && peers.length) {
      const records = db.prepare("SELECT id,origin_node_id AS originNodeId FROM inquiries").all();
      for (const record of records) queueRecord({ id: record.id, originNodeId: record.originNodeId });
    }
    const server = http.createServer(app);
    listener = server;
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, host, () => { server.off("error", reject); resolve(); });
    });
    if (secret && peers.length) {
      timer = setInterval(() => { void flushOutbox(); void flushTenantOutbox(); }, 2_000);
      timer.unref();
      void flushOutbox();
      void flushTenantOutbox();
    }
    return { server, host, port: server.address()?.port ?? port };
  }

  async function close() {
    if (timer) clearInterval(timer);
    if (listener?.listening) await new Promise((resolve) => listener.close(resolve));
    if (db.open) db.close();
  }

  return { app, db, nodeId, port, host, syncEnabled, start, close, flushOutbox };
}

loadEnv();
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const server = createServer();
    const started = await server.start();
    console.log(`Mobile API node ${server.nodeId} listening on http://${server.host}:${started.port}`);
    const shutdown = async () => { await server.close(); process.exit(0); };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "API server failed to start");
    process.exitCode = 1;
  }
}
