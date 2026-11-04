import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { migrateTenantIsolation } from "../scripts/migrate-tenant-isolation.mjs";
import { inspectTransactionAuthorizationSchema } from "../scripts/inspect-transaction-authorization-schema.mjs";

test("schema contract audit is read-only and reports missing tenant/site integrity constraints", () => {
  const db = new Database(":memory:");
  try {
    db.exec("CREATE TABLE inquiries (id TEXT PRIMARY KEY)");
    migrateTenantIsolation(db);

    const before = db.prepare("SELECT name, sql FROM sqlite_master WHERE type IN ('table','index','trigger') ORDER BY type,name").all();
    const report = inspectTransactionAuthorizationSchema(db);
    const after = db.prepare("SELECT name, sql FROM sqlite_master WHERE type IN ('table','index','trigger') ORDER BY type,name").all();

    assert.deepEqual(after, before, "schema inspection must not mutate the database");
    assert.ok(report.tables.includes("transaction_access_assignments"));
    assert.ok(report.tables.includes("transaction_site_links"));
    assert.deepEqual(
      report.findings.map((finding) => finding.code).sort(),
      [
        "ASSIGNMENT_TENANT_SITE_FK_MISSING",
        "ASSIGNMENT_TENANT_TRANSACTION_FK_MISSING",
        "SITE_LINK_TENANT_SITE_FK_MISSING",
        "SITE_LINK_TENANT_TRANSACTION_FK_MISSING",
        "TRANSACTION_ENTERPRISE_BRIDGE_MISSING",
      ].sort(),
    );
    assert.equal(report.blockerCount, 5);
    assert.equal(db.pragma("integrity_check", { simple: true }), "ok");
    assert.deepEqual(db.pragma("foreign_key_check"), []);
  } finally {
    db.close();
  }
});
