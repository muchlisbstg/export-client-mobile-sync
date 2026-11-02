import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import crypto from "node:crypto";
import { migrateTenantIsolation } from "../scripts/migrate-tenant-isolation.mjs";
import { bootstrapEnterprise } from "../scripts/bootstrap-enterprise.mjs";

const token = "test-only-enterprise-bootstrap-token-32";
const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

function migratedDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE products (id TEXT PRIMARY KEY);
    CREATE TABLE inquiries (
      id TEXT PRIMARY KEY,
      tracking_code TEXT NOT NULL UNIQUE,
      customer_email TEXT NOT NULL,
      origin_node_id TEXT NOT NULL DEFAULT 'legacy'
    );
  `);
  migrateTenantIsolation(db);
  return db;
}

test("first enterprise bootstrap creates one seller enterprise, initial admin membership, role and audit", () => {
  const db = migratedDb();
  try {
    const result = bootstrapEnterprise(db, {
      enterpriseId: "global-export",
      userId: "supabase-user-001",
      displayName: "Global Export",
      token,
      expectedTokenHash: tokenHash,
    });
    assert.equal(result.enterpriseId, "global-export");
    assert.equal(result.membershipRole, "seller_admin");
    assert.equal(result.enterpriseRole, "enterprise_admin");
    assert.equal(result.status, "active");
    assert.deepEqual(db.prepare("SELECT tenant_type,status FROM tenants WHERE id=?").get("global-export"), {
      tenant_type: "seller", status: "active",
    });
    assert.deepEqual(db.prepare("SELECT role,status FROM tenant_memberships WHERE tenant_id=? AND user_id=?").get("global-export", "supabase-user-001"), {
      role: "seller_admin", status: "active",
    });
    assert.deepEqual(db.prepare("SELECT role,status,granted_by FROM enterprise_role_assignments WHERE enterprise_id=? AND user_id=?").get("global-export", "supabase-user-001"), {
      role: "enterprise_admin", status: "active", granted_by: "bootstrap",
    });
    const audit = db.prepare("SELECT action,previous_status,new_status,actor_user_id FROM enterprise_role_audit WHERE enterprise_id=?").get("global-export");
    assert.deepEqual(audit, {
      action: "granted",
      previous_status: null,
      new_status: "active",
      actor_user_id: "supabase-user-001",
    });
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM enterprise_bootstrap_state").get().count, 1);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    db.close();
  }
});

test("enterprise bootstrap rejects a second execution without changing the first administrator", () => {
  const db = migratedDb();
  try {
    const input = {
      enterpriseId: "global-export",
      userId: "supabase-user-001",
      displayName: "Global Export",
      token,
      expectedTokenHash: tokenHash,
    };
    bootstrapEnterprise(db, input);
    assert.throws(() => bootstrapEnterprise(db, { ...input, userId: "supabase-user-002" }), /already been completed/);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM enterprise_role_assignments").get().count, 1);
    assert.equal(db.prepare("SELECT initial_admin_user_id FROM enterprise_bootstrap_state WHERE singleton_id=1").get().initial_admin_user_id, "supabase-user-001");
  } finally {
    db.close();
  }
});

test("enterprise bootstrap rejects invalid token and malformed hash", () => {
  const db = migratedDb();
  try {
    const input = {
      enterpriseId: "global-export",
      userId: "supabase-user-001",
      displayName: "Global Export",
      token: "wrong-token-value-that-is-long-enough",
      expectedTokenHash: tokenHash,
    };
    assert.throws(() => bootstrapEnterprise(db, input), /valid enterprise bootstrap token/);
    assert.throws(() => bootstrapEnterprise(db, { ...input, token, expectedTokenHash: "not-a-hash" }), /valid enterprise bootstrap token/);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM tenants").get().count, 0);
  } finally {
    db.close();
  }
});

test("enterprise bootstrap refuses a non-empty tenant registry", () => {
  const db = migratedDb();
  try {
    const now = new Date().toISOString();
    db.prepare("INSERT INTO tenants (id,tenant_type,display_name,created_at) VALUES ('existing','seller','Existing Enterprise',?)").run(now);
    assert.throws(() => bootstrapEnterprise(db, {
      enterpriseId: "global-export",
      userId: "supabase-user-001",
      displayName: "Global Export",
      token,
      expectedTokenHash: tokenHash,
    }), /empty tenant and role registry/);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM tenants").get().count, 1);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM enterprise_bootstrap_state").get().count, 0);
  } finally {
    db.close();
  }
});

test("enterprise bootstrap validates identity and display name before writing", () => {
  const db = migratedDb();
  try {
    assert.throws(() => bootstrapEnterprise(db, {
      enterpriseId: "global-export",
      userId: " ",
      displayName: "G",
      token,
      expectedTokenHash: tokenHash,
    }), /enterprise ID, Supabase user ID, and display name are required/);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM tenants").get().count, 0);
  } finally {
    db.close();
  }
});
