import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { migrateTenantIsolation } from "../scripts/migrate-tenant-isolation.mjs";
import { assignEnterpriseRole, revokeEnterpriseRole } from "../scripts/assign-enterprise-role.mjs";

function legacyDb() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE products (id TEXT PRIMARY KEY);
    CREATE TABLE inquiries (id TEXT PRIMARY KEY, tracking_code TEXT NOT NULL UNIQUE, customer_email TEXT NOT NULL, origin_node_id TEXT NOT NULL DEFAULT 'legacy');
    INSERT INTO inquiries (id, tracking_code, customer_email, origin_node_id)
      VALUES ('legacy-1', 'ABCDEF0123456789ABCDEF01', 'old@example.test', 'legacy');
  `);
  return db;
}

test("legacy inquiry ownership stays null and unassigned", () => {
  const db = legacyDb();
  try {
    migrateTenantIsolation(db);
    const row = db.prepare("SELECT buyer_tenant_id,seller_tenant_id,tenant_migration_state FROM inquiries WHERE id='legacy-1'").get();
    assert.equal(row.buyer_tenant_id, null);
    assert.equal(row.seller_tenant_id, null);
    assert.equal(row.tenant_migration_state, "unassigned");
  } finally { db.close(); }
});

test("migration is idempotent and creates tenant model tables", () => {
  const db = legacyDb();
  try {
    assert.doesNotThrow(() => migrateTenantIsolation(db));
    assert.doesNotThrow(() => migrateTenantIsolation(db));
    for (const table of ["tenants","tenant_memberships","enterprise_role_assignments","commercial_transactions","tenant_sync_outbox"]) {
      assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table));
    }
  } finally { db.close(); }
});

test("enterprise role provisioning requires active membership and records explicit least-privilege roles", () => {
  const db = legacyDb();
  const previousOperatorToken = process.env.ROLE_PROVISIONING_OPERATOR_TOKEN;
  const previousOperatorHashes = process.env.ROLE_PROVISIONING_OPERATOR_TOKEN_HASHES_JSON;
  process.env.ROLE_PROVISIONING_OPERATOR_TOKEN = "test-admin-token";
  process.env.ROLE_PROVISIONING_OPERATOR_TOKEN_HASHES_JSON = JSON.stringify({
    "admin-user": crypto.createHash("sha256").update("test-admin-token").digest("hex"),
  });
  try {
    migrateTenantIsolation(db);
    const now = new Date().toISOString();
    db.prepare("INSERT INTO tenants(id,tenant_type,display_name,created_at) VALUES(?,?,?,?)").run("enterprise-1","seller","Enterprise One",now);
    db.prepare("INSERT INTO tenant_memberships(tenant_id,user_id,role,status,created_at) VALUES(?,?,?,'active',?)").run("enterprise-1","qc-user","seller_member",now);
    db.prepare("INSERT INTO tenant_memberships(tenant_id,user_id,role,status,created_at) VALUES(?,?,?,'active',?)").run("enterprise-1","admin-user","seller_admin",now);
    db.prepare("INSERT INTO enterprise_role_assignments(enterprise_id,user_id,role,status,granted_by,created_at) VALUES(?,?,'enterprise_admin','active',?,?)").run("enterprise-1","admin-user","bootstrap",now);
    assert.deepEqual(assignEnterpriseRole(db,{enterpriseId:"enterprise-1",userId:"qc-user",role:"qc",grantedBy:"admin-user"}),{
      enterpriseId:"enterprise-1",userId:"qc-user",role:"qc",status:"active",grantedBy:"admin-user",
    });
    assert.equal(db.prepare("SELECT granted_by FROM enterprise_role_assignments WHERE user_id='qc-user' AND role='qc'").get().granted_by,"admin-user");
    const roleAudit = db.prepare("SELECT action,previous_status,new_status,actor_user_id FROM enterprise_role_audit WHERE enterprise_id='enterprise-1' AND user_id='qc-user' AND role='qc'").get();
    assert.deepEqual(roleAudit,{action:"granted",previous_status:null,new_status:"active",actor_user_id:"admin-user"});
    assert.throws(() => db.prepare("UPDATE enterprise_role_audit SET actor_user_id='tampered' WHERE user_id='qc-user'").run(), /enterprise_role_audit_is_append_only/);
    assert.throws(() => db.prepare("DELETE FROM enterprise_role_audit WHERE user_id='qc-user'").run(), /enterprise_role_audit_is_append_only/);
    assert.throws(()=>assignEnterpriseRole(db,{enterpriseId:"enterprise-1",userId:"missing-user",role:"warehouse",grantedBy:"admin-user"}),/active membership/);
    assert.throws(()=>assignEnterpriseRole(db,{enterpriseId:"enterprise-1",userId:"qc-user",role:"root",grantedBy:"admin-user"}),/unsupported enterprise role/);
    assert.throws(()=>assignEnterpriseRole(db,{enterpriseId:"enterprise-1",userId:"qc-user",role:"warehouse"}),/operator ID are required/);
    assert.throws(()=>assignEnterpriseRole(db,{enterpriseId:"enterprise-1",userId:"qc-user",role:"warehouse",grantedBy:"qc-user"}),/operator authorization/);
    assert.throws(()=>assignEnterpriseRole(db,{enterpriseId:"enterprise-1",userId:"qc-user",role:"warehouse",grantedBy:"missing-operator"}),/operator authorization/);
    process.env.ROLE_PROVISIONING_OPERATOR_TOKEN = "invalid-token";
    assert.throws(()=>assignEnterpriseRole(db,{enterpriseId:"enterprise-1",userId:"qc-user",role:"warehouse",grantedBy:"admin-user"}),/operator authorization/);
    process.env.ROLE_PROVISIONING_OPERATOR_TOKEN = "test-admin-token";
    db.prepare("UPDATE tenant_memberships SET status='suspended' WHERE user_id='admin-user'").run();
    assert.throws(()=>assignEnterpriseRole(db,{enterpriseId:"enterprise-1",userId:"qc-user",role:"warehouse",grantedBy:"admin-user"}),/different active enterprise_admin/);
    db.prepare("UPDATE tenant_memberships SET status='active' WHERE user_id='admin-user'").run();
    assert.deepEqual(revokeEnterpriseRole(db,{enterpriseId:"enterprise-1",userId:"qc-user",role:"qc",revokedBy:"admin-user",reason:"access no longer needed"}),{
      enterpriseId:"enterprise-1",userId:"qc-user",role:"qc",status:"revoked",revokedBy:"admin-user",
    });
    assert.equal(db.prepare("SELECT status FROM enterprise_role_assignments WHERE enterprise_id='enterprise-1' AND user_id='qc-user' AND role='qc'").get().status,"revoked");
    const revokedAudit=db.prepare("SELECT action,previous_status,new_status,actor_user_id,reason FROM enterprise_role_audit WHERE user_id='qc-user' AND role='qc' ORDER BY occurred_at DESC LIMIT 1").get();
    assert.deepEqual(revokedAudit,{action:"revoked",previous_status:"active",new_status:"revoked",actor_user_id:"admin-user",reason:"access no longer needed"});
  } finally {
    db.close();
    if (previousOperatorToken === undefined) delete process.env.ROLE_PROVISIONING_OPERATOR_TOKEN;
    else process.env.ROLE_PROVISIONING_OPERATOR_TOKEN = previousOperatorToken;
    if (previousOperatorHashes === undefined) delete process.env.ROLE_PROVISIONING_OPERATOR_TOKEN_HASHES_JSON;
    else process.env.ROLE_PROVISIONING_OPERATOR_TOKEN_HASHES_JSON = previousOperatorHashes;
  }
});

test("migration refuses to run without the existing inquiries table", () => {
  const db = new Database(":memory:");
  try { assert.throws(() => migrateTenantIsolation(db), /inquiries table must exist/); }
  finally { db.close(); }
});


test("migration runs on an isolated representative SQLite backup and leaves source untouched", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "tenant-migration-copy-"));
  const source = new Database(":memory:");
  let copy;
  try {
    source.pragma("foreign_keys = ON");
    source.exec(`
      CREATE TABLE products (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL,
        origin TEXT NOT NULL, unit TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE inquiries (
        id TEXT PRIMARY KEY, tracking_code TEXT NOT NULL UNIQUE, customer_name TEXT NOT NULL,
        customer_email TEXT NOT NULL, destination_country TEXT NOT NULL,
        product_id TEXT NOT NULL REFERENCES products(id), quantity REAL NOT NULL CHECK(quantity > 0),
        unit TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'received', created_at TEXT NOT NULL,
        origin_node_id TEXT NOT NULL DEFAULT 'legacy'
      );
      CREATE TABLE sync_outbox (
        inquiry_id TEXT NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE, peer_node_id TEXT NOT NULL,
        peer_url TEXT NOT NULL, attempt_count INTEGER NOT NULL DEFAULT 0,
        next_attempt_at_ms INTEGER NOT NULL DEFAULT 0, last_error TEXT,
        PRIMARY KEY(inquiry_id,peer_node_id)
      );
      CREATE TABLE sync_conflicts (
        conflict_id INTEGER PRIMARY KEY AUTOINCREMENT, inquiry_id TEXT NOT NULL, peer_node_id TEXT NOT NULL,
        existing_hash TEXT NOT NULL, incoming_hash TEXT NOT NULL, reason TEXT NOT NULL, detected_at TEXT NOT NULL
      );
      INSERT INTO products (id,name,category,origin,unit,active) VALUES ('green-coffee','Green Coffee','Coffee','Indonesia','kg',1);
      INSERT INTO inquiries (id,tracking_code,customer_name,customer_email,destination_country,product_id,quantity,unit,status,created_at,origin_node_id)
      VALUES ('legacy-row','ABCDEF0123456789ABCDEF01','Legacy Buyer','buyer@example.test','Japan','green-coffee',100,'kg','received','2026-01-01T00:00:00.000Z','legacy');
      INSERT INTO sync_outbox (inquiry_id,peer_node_id,peer_url) VALUES ('legacy-row','peer-a','https://peer.example.test');
    `);
    const copyPath = path.join(directory, "representative-copy.sqlite");
    await source.backup(copyPath);
    copy = new Database(copyPath);
    copy.pragma("foreign_keys = ON");
    assert.deepEqual(copy.prepare("PRAGMA integrity_check").all(), [{ integrity_check: "ok" }]);
    migrateTenantIsolation(copy);
    assert.deepEqual(copy.prepare("PRAGMA integrity_check").all(), [{ integrity_check: "ok" }]);
    assert.deepEqual(copy.prepare("PRAGMA foreign_key_check").all(), []);
    const migrated = copy.prepare("SELECT id,tracking_code,customer_email,buyer_tenant_id,seller_tenant_id,tenant_migration_state FROM inquiries WHERE id='legacy-row'").get();
    assert.deepEqual(migrated, {
      id: "legacy-row", tracking_code: "ABCDEF0123456789ABCDEF01", customer_email: "buyer@example.test",
      buyer_tenant_id: null, seller_tenant_id: null, tenant_migration_state: "unassigned",
    });
    assert.equal(copy.prepare("SELECT COUNT(*) AS count FROM sync_outbox").get().count, 1);
    assert.equal(source.prepare("SELECT COUNT(*) AS count FROM inquiries").get().count, 1);
    assert.equal(source.prepare("PRAGMA table_info(inquiries)").all().some((column) => column.name === "buyer_tenant_id"), false);
    const restoredPath=path.join(directory,"restored.sqlite");
    await copy.backup(restoredPath);
    const restored=new Database(restoredPath);
    try {
      assert.deepEqual(restored.prepare("PRAGMA integrity_check").all(),[{integrity_check:"ok"}]);
      assert.deepEqual(restored.prepare("PRAGMA foreign_key_check").all(),[]);
      assert.equal(restored.prepare("SELECT COUNT(*) AS count FROM inquiries WHERE id='legacy-row'").get().count,1);
      assert.equal(restored.prepare("SELECT COUNT(*) AS count FROM enterprise_role_audit").get().count,0);
    } finally { restored.close(); }
  } finally {
    if (copy?.open) copy.close();
    source.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});


test("tenant synchronization outbox persists retryable events across database reopen", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "tenant-outbox-"));
  const file = path.join(directory, "outbox.sqlite");
  let db = new Database(file);
  try {
    db.exec("CREATE TABLE inquiries (id TEXT PRIMARY KEY)");
    migrateTenantIsolation(db);
    db.prepare(`INSERT INTO tenant_sync_outbox
      (event_id,peer_node_id,peer_url,event_type,aggregate_id,payload_json,attempt_count,next_attempt_at_ms,created_at)
      VALUES (?,?,?,?,?,?,?,?,?)`).run(
      "event-1","peer-b","https://peer.example.test","transaction.upsert","txn-1",
      JSON.stringify({ id: "txn-1", status: "pending" }),2,Date.now()+5000,new Date().toISOString()
    );
  } finally { db.close(); }
  db = new Database(file);
  try {
    const event = db.prepare("SELECT event_id,peer_node_id,event_type,aggregate_id,attempt_count,payload_json,delivered_at FROM tenant_sync_outbox WHERE event_id='event-1'").get();
    assert.equal(event.peer_node_id,"peer-b");
    assert.equal(event.event_type,"transaction.upsert");
    assert.equal(event.aggregate_id,"txn-1");
    assert.equal(event.attempt_count,2);
    assert.deepEqual(JSON.parse(event.payload_json),{id:"txn-1",status:"pending"});
    assert.equal(event.delivered_at,null);
  } finally {
    db.close();
    fs.rmSync(directory,{recursive:true,force:true});
  }
});

test("migration upgrades an earlier outbox schema without losing pending events", () => {
  const db = new Database(":memory:");
  try {
    db.exec(`
      CREATE TABLE inquiries (id TEXT PRIMARY KEY);
      CREATE TABLE tenant_sync_outbox (
        event_id TEXT PRIMARY KEY, peer_node_id TEXT NOT NULL, peer_url TEXT NOT NULL,
        event_type TEXT NOT NULL, aggregate_id TEXT NOT NULL, payload_json TEXT NOT NULL,
        attempt_count INTEGER NOT NULL DEFAULT 0, next_attempt_at_ms INTEGER NOT NULL DEFAULT 0,
        last_error TEXT, created_at TEXT NOT NULL, delivered_at TEXT,
        UNIQUE(event_id,peer_node_id)
      );
      INSERT INTO tenant_sync_outbox(event_id,peer_node_id,peer_url,event_type,aggregate_id,payload_json,created_at)
      VALUES ('old-event','peer-a','https://peer.example.test','transaction.upsert','txn-old','{}','2026-01-01T00:00:00.000Z');
    `);
    migrateTenantIsolation(db);
    const row = db.prepare("SELECT event_id,queue_seq,delivered_at FROM tenant_sync_outbox WHERE event_id='old-event'").get();
    assert.equal(row.event_id,"old-event");
    assert.equal(typeof row.queue_seq,"number");
    assert.equal(row.delivered_at,null);
    assert.doesNotThrow(() => migrateTenantIsolation(db));
  } finally { db.close(); }
});
