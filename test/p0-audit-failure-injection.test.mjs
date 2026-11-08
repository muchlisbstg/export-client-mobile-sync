import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer } from "../server/index.mjs";
import { migrateTenantIsolation } from "../scripts/migrate-tenant-isolation.mjs";

test("transaction grant, revoke, and site-link mutations roll back when audit persistence fails", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p0-audit-failure-"));
  const tokenUsers = new Map([["token-admin", "user-admin"], ["token-supplier", "user-supplier"]]);
  const service = createServer({
    host: "127.0.0.1",
    port: 0,
    dbPath: path.join(dir, "api.sqlite"),
    singleEnterpriseId: "enterprise-1",
    supabaseUrl: "https://auth.example.test",
    supabaseAnonKey: "synthetic-test-key",
    authFetcher: async (_url, init) => {
      const token = init.headers.Authorization?.replace(/^Bearer /, "") ?? "";
      const id = tokenUsers.get(token);
      return id
        ? new Response(JSON.stringify({ id }), { status: 200 })
        : new Response("{}", { status: 401 });
    },
  });

  try {
    const started = await service.start();
    const db = service.db;
    migrateTenantIsolation(db);
    const now = new Date().toISOString();

    db.prepare("INSERT INTO tenants(id,tenant_type,display_name,created_at) VALUES('enterprise-1','seller','Enterprise One',?)").run(now);
    db.prepare("INSERT INTO tenants(id,tenant_type,display_name,created_at) VALUES('buyer-1','buyer','Buyer One',?)").run(now);
    const member = db.prepare("INSERT INTO tenant_memberships(tenant_id,user_id,role,status,created_at) VALUES('enterprise-1',?,?, 'active',?)");
    member.run("user-admin", "seller_admin", now);
    member.run("user-supplier", "seller_member", now);
    member.run("user-supplier-2", "seller_member", now);
    const role = db.prepare("INSERT INTO enterprise_role_assignments(enterprise_id,user_id,role,status,created_at) VALUES('enterprise-1',?,?, 'active',?)");
    role.run("user-admin", "enterprise_admin", now);
    role.run("user-supplier", "supplier", now);
    role.run("user-supplier-2", "supplier", now);

    db.prepare("INSERT INTO commercial_transactions(id,buyer_tenant_id,seller_tenant_id,status,created_at) VALUES('tx-1','buyer-1','enterprise-1','pending',?)").run(now);
    db.prepare("INSERT INTO supply_sites(id,tenant_id,site_code,name,site_type,active,created_at) VALUES('site-1','enterprise-1','SITE-1','Supplier Site','supplier',1,?)").run(now);
    db.prepare("INSERT INTO transaction_site_links(tenant_id,transaction_id,site_id,purpose,created_by,created_at) VALUES('enterprise-1','tx-1','site-1','supplier_fulfilment','user-admin',?)").run(now);
    db.prepare("INSERT INTO supply_site_assignments(tenant_id,user_id,site_id,status,granted_by,created_at,updated_at) VALUES('enterprise-1','user-supplier','site-1','active','user-admin',?,?)").run(now, now);

    const assignment = db.prepare("INSERT INTO transaction_access_assignments(tenant_id,transaction_id,user_id,role,site_id,status,granted_by,created_at) VALUES('enterprise-1','tx-1','user-supplier','supplier','site-1',?,'user-admin',?)");
    assignment.run("revoked", now);
    const request = (method, route, body) => fetch(`http://127.0.0.1:${started.port}${route}`, {
      method,
      headers: { Authorization: "Bearer token-admin", "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

    db.exec(`
      CREATE TRIGGER injected_audit_insert_failure
      BEFORE INSERT ON supply_audit_events
      BEGIN SELECT RAISE(ABORT, 'injected_audit_insert_failure'); END;
    `);

    const siteGrant = await request("POST", "/api/v1/supply/sites/site-1/assignments", { userId: "user-supplier-2" });
    assert.equal(siteGrant.status, 503);
    assert.equal(db.prepare("SELECT 1 FROM supply_site_assignments WHERE tenant_id='enterprise-1' AND user_id='user-supplier-2' AND site_id='site-1'").get(), undefined,
      "failed audit must roll back a site-assignment grant");

    const siteRevoke = await request("DELETE", "/api/v1/supply/sites/site-1/assignments/user-supplier");
    assert.equal(siteRevoke.status, 503);
    assert.equal(db.prepare("SELECT status FROM supply_site_assignments WHERE tenant_id='enterprise-1' AND user_id='user-supplier' AND site_id='site-1'").get().status, "active",
      "failed audit must roll back a site-assignment revocation");

    const lotIntake = await request("POST", "/api/v1/supply/lots", {
      siteId: "site-1", lotCode: "AUDIT-FAIL-LOT", commodityName: "Synthetic coffee", quantityMilli: 1000, unit: "kg",
    });
    assert.equal(lotIntake.status, 503);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM supply_lots WHERE tenant_id='enterprise-1' AND lot_code='AUDIT-FAIL-LOT'").get().n, 0,
      "failed audit must roll back a supply-chain lot mutation");

    const grant = await request("POST", "/api/v1/transactions/tx-1/access-assignments", {
      userId: "user-supplier", role: "supplier", siteId: "site-1",
    });
    assert.equal(grant.status, 503);
    assert.equal(db.prepare("SELECT status FROM transaction_access_assignments WHERE tenant_id='enterprise-1' AND transaction_id='tx-1' AND user_id='user-supplier' AND role='supplier'").get().status, "revoked",
      "failed audit must roll back the attempted regrant");

    db.prepare("UPDATE transaction_access_assignments SET status='active' WHERE tenant_id='enterprise-1' AND transaction_id='tx-1' AND user_id='user-supplier' AND role='supplier'").run();
    const revoke = await request("DELETE", "/api/v1/transactions/tx-1/access-assignments/user-supplier/supplier");
    assert.equal(revoke.status, 503);
    assert.equal(db.prepare("SELECT status FROM transaction_access_assignments WHERE tenant_id='enterprise-1' AND transaction_id='tx-1' AND user_id='user-supplier' AND role='supplier'").get().status, "active",
      "failed audit must roll back the attempted revocation");

    const link = await request("POST", "/api/v1/transactions/tx-1/site-links", { siteId: "site-1", purpose: "audit" });
    assert.equal(link.status, 503);
    assert.equal(db.prepare("SELECT 1 FROM transaction_site_links WHERE tenant_id='enterprise-1' AND transaction_id='tx-1' AND site_id='site-1' AND purpose='audit'").get(), undefined,
      "failed audit must roll back the attempted site link");
  } finally {
    await service.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
