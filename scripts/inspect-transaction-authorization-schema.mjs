const requiredTables = [
  "commercial_transactions",
  "transaction_access_assignments",
  "transaction_site_links",
  "supply_sites",
];

function tableExists(db, name) {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name));
}

function hasForeignKey(db, sourceTable, targetTable, pairs) {
  if (!tableExists(db, sourceTable) || !tableExists(db, targetTable)) return false;
  const rows = db.prepare(`PRAGMA foreign_key_list("${sourceTable}")`).all();
  const groups = new Map();
  for (const row of rows) {
    const group = groups.get(row.id) ?? [];
    group.push([row.from, row.to]);
    groups.set(row.id, group);
  }
  const expected = pairs.map(([from, to]) => `${from}->${to}`).sort().join("|");
  return [...groups.entries()].some(([id, group]) => {
    const target = rows.find((row) => row.id === id)?.table;
    return target === targetTable
      && group.map(([from, to]) => `${from}->${to}`).sort().join("|") === expected;
  });
}

/**
 * Read-only schema contract inspection. It never creates, alters, or migrates tables.
 * The transaction_enterprise_parties bridge is required because a transaction can
 * belong to either its buyer enterprise or seller enterprise.
 */
export function inspectTransactionAuthorizationSchema(db) {
  const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((row) => row.name));
  const findings = [];
  for (const name of requiredTables) {
    if (!tables.has(name)) findings.push({ code: "REQUIRED_TABLE_MISSING", table: name, severity: "blocker" });
  }

  if (!tables.has("transaction_enterprise_parties")) {
    findings.push({
      code: "TRANSACTION_ENTERPRISE_BRIDGE_MISSING",
      table: "transaction_enterprise_parties",
      severity: "blocker",
      detail: "A transaction may be scoped to either buyer_tenant_id or seller_tenant_id; a bridge is needed for composite tenant/transaction foreign keys.",
    });
  }

  if (!hasForeignKey(db, "transaction_access_assignments", "transaction_enterprise_parties", [
    ["tenant_id", "tenant_id"], ["transaction_id", "transaction_id"],
  ])) {
    findings.push({
      code: "ASSIGNMENT_TENANT_TRANSACTION_FK_MISSING",
      table: "transaction_access_assignments",
      severity: "blocker",
    });
  }

  if (!hasForeignKey(db, "transaction_access_assignments", "supply_sites", [
    ["tenant_id", "tenant_id"], ["site_id", "id"],
  ])) {
    findings.push({
      code: "ASSIGNMENT_TENANT_SITE_FK_MISSING",
      table: "transaction_access_assignments",
      severity: "blocker",
    });
  }

  if (!hasForeignKey(db, "transaction_site_links", "transaction_enterprise_parties", [
    ["tenant_id", "tenant_id"], ["transaction_id", "transaction_id"],
  ])) {
    findings.push({
      code: "SITE_LINK_TENANT_TRANSACTION_FK_MISSING",
      table: "transaction_site_links",
      severity: "blocker",
    });
  }

  if (!hasForeignKey(db, "transaction_site_links", "supply_sites", [
    ["tenant_id", "tenant_id"], ["site_id", "id"],
  ])) {
    findings.push({
      code: "SITE_LINK_TENANT_SITE_FK_MISSING",
      table: "transaction_site_links",
      severity: "blocker",
    });
  }

  return {
    tables: [...tables].sort(),
    findings,
    blockerCount: findings.filter((finding) => finding.severity === "blocker").length,
  };
}
