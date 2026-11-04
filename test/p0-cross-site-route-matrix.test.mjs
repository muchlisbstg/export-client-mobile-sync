import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer } from "../server/index.mjs";
import { migrateTenantIsolation } from "../scripts/migrate-tenant-isolation.mjs";
import { migrateSupplyChainDatabase } from "../scripts/migrate-supply-chain.mjs";
import { createSupplyChainService } from "../server/supply-chain.mjs";

test("P0 cross-site route matrix denies unassigned and mismatched site access without side effects", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p0-cross-site-routes-"));
  const tokenUsers = new Map([
    ["token-admin", "cross-admin"],
    ["token-warehouse", "cross-warehouse"],
    ["token-qc", "cross-qc"],
  ]);
  const server = createServer({
    host: "127.0.0.1",
    port: 0,
    dbPath: path.join(dir, "api.sqlite"),
    singleEnterpriseId: "cross-enterprise",
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
    const started = await server.start();
    const base = `http://127.0.0.1:${started.port}`;
    const db = server.db;
    migrateTenantIsolation(db);
    migrateSupplyChainDatabase(db);

    const now = new Date().toISOString();
    db.prepare("INSERT INTO tenants(id,tenant_type,display_name,created_at) VALUES(?,?,?,?)")
      .run("cross-enterprise", "seller", "Synthetic Cross-Site Enterprise", now);
    const membership = db.prepare("INSERT INTO tenant_memberships(tenant_id,user_id,role,status,created_at) VALUES(?,?,?,'active',?)");
    const role = db.prepare("INSERT INTO enterprise_role_assignments(enterprise_id,user_id,role,status,created_at) VALUES(?,?,?,'active',?)");
    for (const [userId, memberRole, enterpriseRole] of [
      ["cross-admin", "seller_admin", "enterprise_admin"],
      ["cross-warehouse", "seller_member", "warehouse"],
      ["cross-qc", "seller_member", "qc"],
    ]) {
      membership.run("cross-enterprise", userId, memberRole, now);
      role.run("cross-enterprise", userId, enterpriseRole, now);
    }

    const service = createSupplyChainService(db);
    const warehouseSite = service.createSite({
      tenantId: "cross-enterprise", siteCode: "SYN-WH", name: "Synthetic Warehouse",
      siteType: "warehouse", actorId: "cross-admin",
    });
    const qcSite = service.createSite({
      tenantId: "cross-enterprise", siteCode: "SYN-QC", name: "Synthetic QC Site",
      siteType: "packing_house", actorId: "cross-admin",
    });
    const grant = db.prepare(`INSERT INTO supply_site_assignments
      (tenant_id,user_id,site_id,status,granted_by,created_at,updated_at)
      VALUES('cross-enterprise',?,?, 'active','cross-admin',?,?)`);
    grant.run("cross-warehouse", warehouseSite.id, now, now);
    grant.run("cross-qc", qcSite.id, now, now);

    const lot = service.receiveLot({
      tenantId: "cross-enterprise", siteId: warehouseSite.id, lotCode: "SYN-CROSS-LOT",
      productId: "synthetic-coffee", commodityName: "Synthetic coffee",
      quantityMilli: 1000, unit: "kg", actorId: "cross-admin",
      idempotencyKey: "synthetic-cross-site-seed",
    });

    const request = (token, route, method = "GET", body) => fetch(base + route, {
      method,
      headers: {
        Authorization: `Bearer token-${token}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const before = {
      inspections: db.prepare("SELECT COUNT(*) AS n FROM quality_inspections").get().n,
      movements: db.prepare("SELECT COUNT(*) AS n FROM inventory_movements").get().n,
      entries: db.prepare("SELECT COUNT(*) AS n FROM inventory_entries").get().n,
      evidence: db.prepare("SELECT COUNT(*) AS n FROM supply_evidence").get().n,
    };

    const cases = [
      {
        name: "QC inspection cannot substitute its assigned QC site for the lot's warehouse site",
        token: "qc",
        route: `/api/v1/supply/lots/${lot.lotId}/inspections`,
        method: "POST",
        body: { siteId: qcSite.id, inspectionType: "receiving", result: "pass" },
      },
      {
        name: "warehouse processing cannot target an unassigned QC site",
        token: "warehouse",
        route: "/api/v1/supply/processing",
        method: "POST",
        body: { siteId: qcSite.id, inputs: [], outputs: [] },
      },
      {
        name: "warehouse stock read cannot cross into an unassigned QC site",
        token: "warehouse",
        route: `/api/v1/supply/stock?siteId=${encodeURIComponent(qcSite.id)}`,
      },
      {
        name: "lot trace cannot be read from a site outside the QC user's assignment",
        token: "qc",
        route: `/api/v1/supply/lots/${lot.lotId}/trace`,
      },
    ];

    for (const item of cases) {
      const response = await request(item.token, item.route, item.method ?? "GET", item.body);
      assert.equal(response.status, 403, `${item.name}; received ${response.status}: ${await response.clone().text()}`);
    }

    const after = {
      inspections: db.prepare("SELECT COUNT(*) AS n FROM quality_inspections").get().n,
      movements: db.prepare("SELECT COUNT(*) AS n FROM inventory_movements").get().n,
      entries: db.prepare("SELECT COUNT(*) AS n FROM inventory_entries").get().n,
      evidence: db.prepare("SELECT COUNT(*) AS n FROM supply_evidence").get().n,
    };
    assert.deepEqual(after, before, "denied cross-site requests must not mutate inspection, movement, inventory, or evidence records");
  } finally {
    await server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});


test("P0 handover and evidence enforce both site boundaries and active assignments", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p0-handover-evidence-"));
  const tokenUsers = new Map([
    ["token-admin", "hx-admin"],
    ["token-source-only", "hx-source-only"],
    ["token-destination-only", "hx-destination-only"],
    ["token-revoked", "hx-revoked"],
  ]);
  const server = createServer({
    host: "127.0.0.1", port: 0, dbPath: path.join(dir, "api.sqlite"),
    singleEnterpriseId: "hx-enterprise",
    supabaseUrl: "https://auth.example.test", supabaseAnonKey: "synthetic-test-key",
    authFetcher: async (_url, init) => {
      const token = init.headers.Authorization?.replace(/^Bearer /, "") ?? "";
      const id = tokenUsers.get(token);
      return id ? new Response(JSON.stringify({ id }), { status: 200 }) : new Response("{}", { status: 401 });
    },
  });

  try {
    const started = await server.start();
    const base = `http://127.0.0.1:${started.port}`;
    const db = server.db;
    migrateTenantIsolation(db);
    migrateSupplyChainDatabase(db);
    const now = new Date().toISOString();
    db.prepare("INSERT INTO tenants(id,tenant_type,display_name,created_at) VALUES(?,?,?,?)")
      .run("hx-enterprise", "seller", "Synthetic Handover Enterprise", now);
    const membership = db.prepare("INSERT INTO tenant_memberships(tenant_id,user_id,role,status,created_at) VALUES(?,?,?,'active',?)");
    const role = db.prepare("INSERT INTO enterprise_role_assignments(enterprise_id,user_id,role,status,created_at) VALUES(?,?,?,'active',?)");
    for (const [user, memberRole, enterpriseRole] of [
      ["hx-admin", "seller_admin", "enterprise_admin"],
      ["hx-source-only", "seller_member", "logistics"],
      ["hx-destination-only", "seller_member", "logistics"],
      ["hx-revoked", "seller_member", "warehouse"],
    ]) {
      membership.run("hx-enterprise", user, memberRole, now);
      role.run("hx-enterprise", user, enterpriseRole, now);
    }

    const service = createSupplyChainService(db);
    const source = service.createSite({tenantId:"hx-enterprise",siteCode:"HX-SRC",name:"Synthetic Source Warehouse",siteType:"warehouse",actorId:"hx-admin"});
    const destination = service.createSite({tenantId:"hx-enterprise",siteCode:"HX-DST",name:"Synthetic Destination Warehouse",siteType:"warehouse",actorId:"hx-admin"});
    const grant = db.prepare(`INSERT INTO supply_site_assignments
      (tenant_id,user_id,site_id,status,granted_by,created_at,updated_at)
      VALUES('hx-enterprise',?,?, 'active','hx-admin',?,?)`);
    grant.run("hx-source-only", source.id, now, now);
    grant.run("hx-destination-only", destination.id, now, now);
    grant.run("hx-revoked", source.id, now, now);

    const lot = service.receiveLot({
      tenantId:"hx-enterprise",siteId:source.id,lotCode:"HX-LOT",productId:"synthetic-coffee",
      commodityName:"Synthetic coffee",quantityMilli:1000,unit:"kg",actorId:"hx-admin",idempotencyKey:"hx-receipt",
    });
    service.inspectLot({tenantId:"hx-enterprise",lotId:lot.lotId,siteId:source.id,inspectionType:"pre_dispatch",result:"pass",actorId:"hx-admin"});
    const handover = service.prepareHandover({
      tenantId:"hx-enterprise",lotId:lot.lotId,fromSiteId:source.id,toSiteId:destination.id,
      quantityMilli:500,unit:"kg",actorId:"hx-admin",idempotencyKey:"hx-handover",handoverCode:"HX-HO",
      sealNumber:"HX-SEAL",
    });

    const call = (token, route, method = "GET", body) => fetch(base + route, {
      method, headers: {Authorization:`Bearer token-${token}`, ...(body===undefined?{}:{"Content-Type":"application/json"})},
      body:body===undefined?undefined:JSON.stringify(body),
    });
    const snapshot = () => ({
      handovers: db.prepare("SELECT COUNT(*) AS n FROM handovers WHERE tenant_id='hx-enterprise'").get().n,
      handover: db.prepare("SELECT status FROM handovers WHERE tenant_id='hx-enterprise' AND id=?").get(handover.id).status,
      movements: db.prepare("SELECT COUNT(*) AS n FROM inventory_movements").get().n,
      entries: db.prepare("SELECT COUNT(*) AS n FROM inventory_entries").get().n,
      evidence: db.prepare("SELECT COUNT(*) AS n FROM supply_evidence").get().n,
    });
    const before = snapshot();

    const sourceOnlyCannotPrepareHandoverToUnassignedDestination = await call("source-only", "/api/v1/supply/handovers", "POST", {
      lotId:lot.lotId,fromSiteId:source.id,toSiteId:destination.id,quantityMilli:100,unit:"kg",handoverCode:"HX-DENIED",
    });
    assert.equal(sourceOnlyCannotPrepareHandoverToUnassignedDestination.status,403,
      "handover creation must authorize both source and destination sites before writing");

    const sourceCannotDispatchFromUnassignedSource = await call("destination-only", `/api/v1/supply/handovers/${handover.id}/dispatch`, "POST", {});
    assert.equal(sourceCannotDispatchFromUnassignedSource.status, 403, "destination-only user must not dispatch from source site");

    const destinationCannotReceiveAtUnassignedDestination = await call("source-only", `/api/v1/supply/handovers/${handover.id}/receive`, "POST", {receivedQuantityMilli:500,sealNumber:"HX-SEAL"});
    assert.equal(destinationCannotReceiveAtUnassignedDestination.status, 403, "source-only user must not receive at destination site");

    const evidenceFromWrongSite = await call("destination-only", "/api/v1/supply/evidence", "POST", {
      entityType:"handover",entityId:handover.id,evidenceType:"seal_photo",
      storageUri:"storage://synthetic/handover/seal.jpg",contentSha256:"a".repeat(64),
    });
    assert.equal(evidenceFromWrongSite.status, 403, "handover evidence must be scoped to the source site");

    const revoked = await call("admin", `/api/v1/supply/sites/${source.id}/assignments/hx-revoked`, "DELETE", {});
    assert.equal(revoked.status, 200);
    const revokedRead = await call("revoked", `/api/v1/supply/stock?siteId=${encodeURIComponent(source.id)}`);
    assert.equal(revokedRead.status, 403, "revoked assignment must not retain site access");

    db.prepare("UPDATE supply_site_assignments SET status='active',updated_at=? WHERE tenant_id=? AND user_id=? AND site_id=?")
      .run(now,"hx-enterprise","hx-revoked",source.id);
    db.prepare("UPDATE supply_sites SET active=0 WHERE tenant_id=? AND id=?").run("hx-enterprise", source.id);
    const inactiveRead = await call("revoked", `/api/v1/supply/stock?siteId=${encodeURIComponent(source.id)}`);
    assert.equal(inactiveRead.status, 403, "deactivated site must deny access even with active assignment");

    assert.deepEqual(snapshot(), before, "all denied handover/evidence/site requests must leave business records unchanged");
  } finally {
    await server.close();
    fs.rmSync(dir, {recursive:true,force:true});
  }
});
