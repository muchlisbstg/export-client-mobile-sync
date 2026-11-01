const ENTERPRISE_ROLES = new Set([
  "enterprise_admin",
  "buyer",
  "seller",
  "supplier",
  "warehouse",
  "qc",
  "logistics",
  "auditor",
]);

export function createEnterpriseAuthorization({ db, singleEnterpriseId }) {
  if (!db || typeof db.prepare !== "function") {
    throw new TypeError("db must be a better-sqlite3 compatible database");
  }

  function tenantSchemaReady() {
    const tables = new Set(
      db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((row) => row.name),
    );
    if (!["tenants", "tenant_memberships", "enterprise_role_assignments", "commercial_transactions"].every((name) => tables.has(name))) {
      return false;
    }
    const columns = new Set(db.prepare("PRAGMA table_info(inquiries)").all().map((row) => row.name));
    return ["buyer_tenant_id", "seller_tenant_id", "tenant_migration_state"].every((name) => columns.has(name));
  }

  function resolveEnterpriseMembership(userId) {
    if (!singleEnterpriseId || !tenantSchemaReady() || typeof userId !== "string" || !userId.trim()) return null;
    const membership = db.prepare(`SELECT t.id, t.tenant_type AS tenantType, t.display_name AS displayName,
      t.status AS tenantStatus, m.role AS legacyRole, m.status AS membershipStatus
      FROM tenants t JOIN tenant_memberships m ON m.tenant_id=t.id
      WHERE m.user_id=? AND t.id=?`).get(userId, singleEnterpriseId);
    if (!membership || membership.tenantStatus !== "active" || membership.membershipStatus !== "active") return null;

    const roles = db.prepare(`SELECT role FROM enterprise_role_assignments
      WHERE enterprise_id=? AND user_id=? AND status='active' ORDER BY role`)
      .all(singleEnterpriseId, userId)
      .map((row) => row.role)
      .filter((role) => ENTERPRISE_ROLES.has(role));

    if (roles.length === 0) return null;
    return { ...membership, role: roles[0], roles };
  }

  function requireActiveEnterprise(_req, res, next) {
    if (!tenantSchemaReady()) return res.status(503).json({ error: "tenant_schema_not_ready" });
    if (!singleEnterpriseId) return res.status(503).json({ error: "single_enterprise_not_configured" });

    const identity = res.locals.authIdentity;
    if (!identity?.id) return res.status(401).json({ error: "authentication_required" });

    const requestedId = String(_req.get("x-active-tenant-id") ?? "").trim();
    if (requestedId && requestedId !== singleEnterpriseId) {
      return res.status(403).json({ error: "enterprise_context_locked" });
    }

    const membership = resolveEnterpriseMembership(identity.id);
    if (!membership) return res.status(403).json({ error: "enterprise_access_denied" });
    res.locals.activeTenant = membership;
    return next();
  }

  function requireEnterpriseRole(...allowedRoles) {
    const allowed = new Set(allowedRoles.filter((role) => ENTERPRISE_ROLES.has(role)));
    return (_req, res, next) => {
      const roles = res.locals.activeTenant?.roles ?? [];
      if (allowed.size === 0 || !allowedRoles.some((role) => allowed.has(role)) || !allowedRoles.some((role) => roles.includes(role))) {
        return res.status(403).json({ error: "enterprise_role_forbidden" });
      }
      return next();
    };
  }

  return {
    tenantSchemaReady,
    resolveEnterpriseMembership,
    requireActiveEnterprise,
    requireEnterpriseRole,
  };
}
