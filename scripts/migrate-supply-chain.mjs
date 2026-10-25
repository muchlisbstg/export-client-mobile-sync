import Database from "better-sqlite3";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { migrateTenantIsolation } from "./migrate-tenant-isolation.mjs";

/** Apply the additive tenant + supply-chain migrations without assigning legacy ownership. */
export function migrateSupplyChainDatabase(db) {
  const tenant = migrateTenantIsolation(db);
  return { ...tenant, supplyChain: true };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const filePath = process.argv[2];
  if (!filePath) {
    process.stderr.write("Usage: node scripts/migrate-supply-chain.mjs <sqlite-db-path>\n");
    process.exitCode = 2;
  } else {
    const db = new Database(filePath);
    try {
      db.pragma("foreign_keys = ON");
      process.stdout.write(JSON.stringify(migrateSupplyChainDatabase(db)) + "\n");
    } finally { db.close(); }
  }
}
