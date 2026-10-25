import Database from "better-sqlite3";
import crypto from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";

const allowedRoles = new Set(["enterprise_admin","buyer","seller","supplier","warehouse","qc","logistics","auditor"]);

function hasValidOperatorToken(operatorId, token) {
  if (!token) return false;
  let tokenHashes;
  try {
    tokenHashes = JSON.parse(process.env.ROLE_PROVISIONING_OPERATOR_TOKEN_HASHES_JSON ?? "{}");
  } catch {
    return false;
  }
  const expectedHex = tokenHashes?.[operatorId];
  if (typeof expectedHex !== "string" || !/^[a-f0-9]{64}$/i.test(expectedHex)) return false;
  const actual = crypto.createHash("sha256").update(token).digest();
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export function assignEnterpriseRole(db, { enterpriseId, userId, role, grantedBy }) {
  if (!enterpriseId?.trim() || !userId?.trim() || !grantedBy?.trim()) {
    throw new Error("enterpriseId, userId, and authorized operator ID are required");
  }
  if (!allowedRoles.has(role)) throw new Error("unsupported enterprise role");
  if (!hasValidOperatorToken(grantedBy, process.env.ROLE_PROVISIONING_OPERATOR_TOKEN)) {
    throw new Error("valid operator authorization token is required");
  }
  const enterprise = db.prepare("SELECT id,status FROM tenants WHERE id=?").get(enterpriseId);
  if (!enterprise || enterprise.status !== "active") throw new Error("enterprise is missing or inactive");
  const membership = db.prepare("SELECT status FROM tenant_memberships WHERE tenant_id=? AND user_id=?").get(enterpriseId,userId);
  if (!membership || membership.status !== "active") throw new Error("user must have an active membership in the configured enterprise");
  const authorizedOperator = db.prepare(`SELECT 1 AS authorized
    FROM tenant_memberships AS membership
    JOIN enterprise_role_assignments AS assignment
      ON assignment.enterprise_id=membership.tenant_id AND assignment.user_id=membership.user_id
    WHERE membership.tenant_id=? AND membership.user_id=?
      AND membership.status='active' AND assignment.role='enterprise_admin' AND assignment.status='active'`)
    .get(enterpriseId,grantedBy);
  if (grantedBy === userId || !authorizedOperator) {
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
    process.stderr.write("Usage: SINGLE_ENTERPRISE_ID=<id> ROLE_PROVISIONING_OPERATOR_TOKEN=<token> ROLE_PROVISIONING_OPERATOR_TOKEN_HASHES_JSON=<operator-id-to-sha256-map> node scripts/assign-enterprise-role.mjs <db-path> <enterprise-id> <user-id> <role> <active-enterprise-admin-user-id>\n");
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
