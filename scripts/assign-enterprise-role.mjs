import Database from "better-sqlite3";
import path from "node:path";
import { pathToFileURL } from "node:url";

const allowedRoles = new Set(["enterprise_admin","buyer","seller","supplier","warehouse","qc","logistics","auditor"]);

export function assignEnterpriseRole(db, { enterpriseId, userId, role, grantedBy }) {
  if (!enterpriseId?.trim() || !userId?.trim() || !grantedBy?.trim()) {
    throw new Error("enterpriseId, userId, and authorized operator ID are required");
  }
  if (!allowedRoles.has(role)) throw new Error("unsupported enterprise role");
  const enterprise = db.prepare("SELECT id,status FROM tenants WHERE id=?").get(enterpriseId);
  if (!enterprise || enterprise.status !== "active") throw new Error("enterprise is missing or inactive");
  const membership = db.prepare("SELECT status FROM tenant_memberships WHERE tenant_id=? AND user_id=?").get(enterpriseId,userId);
  if (!membership || membership.status !== "active") throw new Error("user must have an active membership in the configured enterprise");
  const operatorMembership = db.prepare("SELECT status FROM tenant_memberships WHERE tenant_id=? AND user_id=?").get(enterpriseId,grantedBy);
  const operatorRole = db.prepare("SELECT status FROM enterprise_role_assignments WHERE enterprise_id=? AND user_id=? AND role='enterprise_admin'").get(enterpriseId,grantedBy);
  if (grantedBy === userId || operatorMembership?.status !== "active" || operatorRole?.status !== "active") {
    throw new Error("role assignment requires a different active enterprise_admin operator");
  }
  const transaction = db.transaction(() => {
    db.prepare(`INSERT INTO enterprise_role_assignments
      (enterprise_id,user_id,role,status,granted_by,created_at)
      VALUES (?,?,?,'active',?,?)
      ON CONFLICT(enterprise_id,user_id,role)
      DO UPDATE SET status='active',granted_by=excluded.granted_by,created_at=excluded.created_at`)
      .run(enterpriseId,userId,role,grantedBy,new Date().toISOString());
  });
  transaction();
  return { enterpriseId, userId, role, status: "active", grantedBy };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const [dbPath, enterpriseId, userId, role, grantedBy] = process.argv.slice(2);
  const configuredId = String(process.env.SINGLE_ENTERPRISE_ID ?? "").trim();
  if (!dbPath || !enterpriseId || !userId || !role || !grantedBy) {
    process.stderr.write("Usage: SINGLE_ENTERPRISE_ID=<id> node scripts/assign-enterprise-role.mjs <db-path> <enterprise-id> <user-id> <role> <active-enterprise-admin-user-id>\n");
    process.exitCode = 2;
  } else if (!configuredId || configuredId !== enterpriseId) {
    process.stderr.write("Refusing assignment: enterprise ID must exactly match configured SINGLE_ENTERPRISE_ID\n");
    process.exitCode = 2;
  } else {
    const db = new Database(dbPath);
    try {
      process.stdout.write(JSON.stringify(assignEnterpriseRole(db,{enterpriseId,userId,role,grantedBy})) + "\n");
    } catch (error) {
      process.stderr.write(`${error instanceof Error ? error.message : "role_assignment_failed"}\n`);
      process.exitCode = 1;
    } finally { db.close(); }
  }
}
