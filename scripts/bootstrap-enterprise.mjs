import Database from "better-sqlite3";
import crypto from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";

function hasValidBootstrapToken(token, expectedHash) {
  if (typeof token !== "string" || token.length < 32) return false;
  if (typeof expectedHash !== "string" || !/^[a-f0-9]{64}$/i.test(expectedHash)) return false;
  const actual = crypto.createHash("sha256").update(token, "utf8").digest();
  const expected = Buffer.from(expectedHash, "hex");
  return crypto.timingSafeEqual(actual, expected);
}

/**
 * Create the first and only initial enterprise administrator.
 * The caller must supply a one-time bootstrap token through a secure channel.
 * This function never creates or migrates the required schema.
 */
export function bootstrapEnterprise(db, {
  enterpriseId,
  userId,
  displayName,
  token,
  expectedTokenHash,
}) {
  const normalized = {
    enterpriseId: String(enterpriseId ?? "").trim(),
    userId: String(userId ?? "").trim(),
    displayName: String(displayName ?? "").trim(),
  };
  if (!normalized.enterpriseId || !normalized.userId || normalized.displayName.length < 2 || normalized.displayName.length > 160) {
    throw new Error("enterprise ID, Supabase user ID, and display name are required");
  }
  if (!hasValidBootstrapToken(token, expectedTokenHash)) {
    throw new Error("valid enterprise bootstrap token is required");
  }

  for (const table of ["tenants", "tenant_memberships", "enterprise_role_assignments", "enterprise_role_audit"]) {
    const exists = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table);
    if (!exists) throw new Error("tenant schema must be migrated before enterprise bootstrap");
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS enterprise_bootstrap_state (
      singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
      enterprise_id TEXT NOT NULL UNIQUE,
      initial_admin_user_id TEXT NOT NULL,
      completed_at TEXT NOT NULL
    )
  `);
  const initialize = db.transaction(() => {
    if (db.prepare("SELECT 1 FROM enterprise_bootstrap_state WHERE singleton_id=1").get()) {
      throw new Error("enterprise bootstrap has already been completed");
    }
    const counts = {
      tenants: db.prepare("SELECT COUNT(*) AS count FROM tenants").get().count,
      memberships: db.prepare("SELECT COUNT(*) AS count FROM tenant_memberships").get().count,
      roles: db.prepare("SELECT COUNT(*) AS count FROM enterprise_role_assignments").get().count,
      audit: db.prepare("SELECT COUNT(*) AS count FROM enterprise_role_audit").get().count,
    };
    if (Object.values(counts).some((count) => count !== 0)) {
      throw new Error("enterprise bootstrap requires an empty tenant and role registry");
    }

    const completedAt = new Date().toISOString();
    db.prepare("INSERT INTO tenants (id,tenant_type,display_name,status,created_at) VALUES (?,'seller',?,'active',?)")
      .run(normalized.enterpriseId, normalized.displayName, completedAt);
    db.prepare("INSERT INTO tenant_memberships (tenant_id,user_id,role,status,created_at) VALUES (?,?,'seller_admin','active',?)")
      .run(normalized.enterpriseId, normalized.userId, completedAt);
    db.prepare(`INSERT INTO enterprise_role_assignments
      (enterprise_id,user_id,role,status,granted_by,created_at)
      VALUES (?,?,'enterprise_admin','active','bootstrap',?)`)
      .run(normalized.enterpriseId, normalized.userId, completedAt);
    db.prepare(`INSERT INTO enterprise_role_audit
      (audit_id,enterprise_id,user_id,role,action,previous_status,new_status,actor_user_id,reason,occurred_at)
      VALUES (?, ?, ?, 'enterprise_admin', 'granted', NULL, 'active', ?, ?, ?)`)
      .run(
        crypto.randomUUID(),
        normalized.enterpriseId,
        normalized.userId,
        normalized.userId,
        "Initial enterprise administrator bootstrap using one-time operator token",
        completedAt,
      );
    db.prepare(`INSERT INTO enterprise_bootstrap_state
      (singleton_id,enterprise_id,initial_admin_user_id,completed_at)
      VALUES (1,?,?,?)`)
      .run(normalized.enterpriseId, normalized.userId, completedAt);

    return {
      enterpriseId: normalized.enterpriseId,
      userId: normalized.userId,
      membershipRole: "seller_admin",
      enterpriseRole: "enterprise_admin",
      status: "active",
      bootstrappedAt: completedAt,
    };
  });

  return initialize.immediate();
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const [dbPath, enterpriseId, userId, displayName] = process.argv.slice(2);
  const configuredId = String(process.env.SINGLE_ENTERPRISE_ID ?? "").trim();
  const token = process.env.ENTERPRISE_BOOTSTRAP_TOKEN;
  const expectedTokenHash = process.env.ENTERPRISE_BOOTSTRAP_TOKEN_SHA256;
  const protectedDbPath = path.join("server", "data", "api.sqlite");
  if (!dbPath || !enterpriseId || !userId || !displayName) {
    process.stderr.write("Usage: node scripts/bootstrap-enterprise.mjs <staging-sqlite-db-path> <enterprise-id> <supabase-user-id> <display-name>\n");
    process.exitCode = 2;
  } else if (path.resolve(dbPath).endsWith(protectedDbPath)) {
    process.stderr.write("Refusing bootstrap against the default application database; use a dedicated staging database path\n");
    process.exitCode = 2;
  } else if (!configuredId || configuredId !== enterpriseId) {
    process.stderr.write("Refusing bootstrap: enterprise ID must exactly match configured SINGLE_ENTERPRISE_ID\n");
    process.exitCode = 2;
  } else if (!token || !expectedTokenHash) {
    process.stderr.write("Refusing bootstrap: secure bootstrap token and SHA-256 hash must be configured\n");
    process.exitCode = 2;
  } else {
    let db;
    try {
      db = new Database(dbPath, { fileMustExist: true });
      db.pragma("foreign_keys = ON");
      process.stdout.write(JSON.stringify(bootstrapEnterprise(db, {
        enterpriseId, userId, displayName, token, expectedTokenHash,
      })) + "\n");
    } catch (error) {
      process.stderr.write(`${error instanceof Error ? error.message : "enterprise_bootstrap_failed"}\n`);
      process.exitCode = 1;
    } finally {
      db?.close();
    }
  }
}
