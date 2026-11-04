import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer } from "../server/index.mjs";
import { migrateTenantIsolation } from "../scripts/migrate-tenant-isolation.mjs";

const users = {
  admin: "p0-admin",
  supplier: "p0-supplier",
  warehouse: "p0-warehouse",
  qc: "p0-qc",
  buyer: "p0-buyer",
  seller: "p0-seller",
  logistics: "p0-logistics",
  auditor: "p0-auditor",
  noRole: "p0-no-role",
  suspended: "p0-suspended",
  unassigned: "p0-unassigned",
};

async function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p0-role-site-"));
  const tokenUsers = new Map(Object.entries(users).map(([token, id]) => [`token-${token}`, id]));
  const service = createServer({
    host: "127.0.0.1",
    port: 0,
    dbPath: path.join(dir, "api.sqlite"),
    singleEnterpriseId: "ent-1",
    supabaseUrl: "https://auth.example.test",
    supabaseAnonKey: "test-anon-key",
    authFetcher: async (_url, init) => {
      const token = init.headers.Authorization?.replace(/^Bearer /, "") ?? "";
      const id = tokenUsers.get(token);
      return id
        ? new Response(JSON.stringify({ id }), { status: 200 })
        : new Response("{}", { status: 401 });
    },
  });
  const started = await service.start();
  const db = service.db;
  migrateTenantIsolation(db);
  const now = new Date().toISOString();

  db.prepare("INSERT INTO tenants(id,tenant_type,display_name,created_at) VALUES('ent-1','seller','Enterprise One',?)").run(now);
  db.prepare("INSERT INTO tenants(id,tenant_type,display_name,created_at) VALUES('ent-2','buyer','Enterprise Two',?)").run(now);
  const membership = db.prepare("INSERT INTO tenant_memberships(tenant_id,user_id,role,status,created_at) VALUES('ent-1',?,?,?,?)");
  const role = db.prepare("INSERT INTO enterprise_role_assignments(enterprise_id,user_id,role,status,created_at) VALUES('ent-1',?,?,?,?)");
  for (const [token, userId] of Object.entries(users)) {
    membership.run(userId, token === "buyer" ? "seller_member" : "seller_member", token === "suspended" ? "suspended" : "active", now);
  }
  for (const [token, userId] of Object.entries(users)) {
    const assignedRole = ({admin:"enterprise_admin",supplier:"supplier",warehouse:"warehouse",qc:"qc",buyer:"buyer",seller:"seller",logistics:"logistics",auditor:"auditor",unassigned:"supplier",suspended:"supplier"})[token];
    if (assignedRole) role.run(userId, assignedRole, "active", now);
  }

  const addSite = db.prepare("INSERT INTO supply_sites(id,tenant_id,site_code,name,site_type,active,created_at) VALUES(?,?,?,?,?,?,?)");
  addSite.run("supplier-site", "ent-1", "SUP-1", "Supplier Site", "supplier", 1, now);
  addSite.run("warehouse-site", "ent-1", "WH-1", "Warehouse Site", "warehouse", 1, now);
  addSite.run("inactive-site", "ent-1", "INACTIVE-1", "Inactive Site", "supplier", 0, now);
  addSite.run("wrong-type-site", "ent-1", "TYPE-1", "Wrong Type Site", "warehouse", 1, now);
  addSite.run("foreign-site", "ent-2", "FOREIGN-1", "Foreign Tenant Site", "supplier", 1, now);

  const assign = db.prepare("INSERT INTO supply_site_assignments(tenant_id,user_id,site_id,status,granted_by,created_at,updated_at) VALUES('ent-1',?,?,?, 'p0-admin',?,?)");
  assign.run(users.supplier, "supplier-site", "active", now, now);
  assign.run(users.warehouse, "warehouse-site", "active", now, now);
  // Buyer visibility uses a buyer-typed site in this enterprise.
  addSite.run("buyer-site", "ent-1", "BUY-1", "Buyer Site", "buyer", 1, now);
  assign.run(users.buyer, "buyer-site", "active", now, now);

  return {
    base: `http://127.0.0.1:${started.port}`,
    db,
    close: async () => {
      await service.close();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

function request(app, token, method, route, body, extraHeaders = {}) {
  return fetch(app.base + route, {
    method,
    headers: {
      Authorization: `Bearer token-${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...extraHeaders,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

test("P0 enterprise boundary rejects missing membership, suspended membership, and tenant override", async () => {
  const app = await fixture();
  try {
    assert.equal((await request(app, "noRole", "GET", "/api/v1/transactions")).status, 403,
      "active tenant membership without an active enterprise role is insufficient");
    assert.equal((await request(app, "suspended", "GET", "/api/v1/transactions")).status, 403,
      "suspended membership must not resolve an active enterprise context");
    assert.equal((await request(app, "supplier", "GET", "/api/v1/transactions", undefined, {
      "x-active-tenant-id": "ent-2",
    })).status, 403, "caller cannot override the configured enterprise context");
  } finally {
    await app.close();
  }
});

test("P0 role matrix rejects roles outside the endpoint contract", async () => {
  const app = await fixture();
  try {
    assert.equal((await request(app, "supplier", "POST", "/api/v1/supply/sites", {
      siteCode: "FORBIDDEN", name: "Forbidden", siteType: "supplier", countryCode: "ID",
    })).status, 403, "supplier cannot create enterprise sites");
    assert.equal((await request(app, "qc", "POST", "/api/v1/supply/processing", {
      siteId: "warehouse-site", inputs: [], outputs: [],
    })).status, 403, "QC cannot invoke warehouse processing");
    assert.equal((await request(app, "warehouse", "POST", "/api/v1/supply/lots/lot-1/inspections", {
      siteId: "warehouse-site", inspectionType: "visual", result: "pass",
    })).status, 403, "warehouse cannot invoke QC inspection");
    assert.equal((await request(app, "supplier", "GET", "/api/v1/supply/stock?siteId=supplier-site")).status, 403,
      "supplier is not granted stock-read role");
    assert.equal((await request(app, "buyer", "POST", "/api/v1/transactions/tx-1/access-assignments", {
      userId: users.supplier, role: "supplier", siteId: "supplier-site",
    })).status, 403, "only enterprise admin can mutate transaction assignments");
  } finally {
    await app.close();
  }
});

test("P0 site scope rejects foreign, inactive, unassigned, and role-incompatible sites", async () => {
  const app = await fixture();
  try {
    for (const siteId of ["foreign-site", "inactive-site", "wrong-type-site", "not-assigned-site"]) {
      const response = await request(app, "supplier", "POST", "/api/v1/supply/lots", {
        siteId, lotCode: `LOT-${siteId}`, commodityName: "Synthetic coffee", quantityMilli: 1000, unit: "kg",
      });
      assert.equal(response.status, 403, `site scope must reject ${siteId}`);
    }
    const validSite = await request(app, "supplier", "POST", "/api/v1/supply/lots", {
      siteId: "supplier-site", lotCode: "LOT-VALID", commodityName: "Synthetic coffee", quantityMilli: 1000, unit: "kg",
    });
    assert.notEqual(validSite.status, 403, "an active assignment to a compatible tenant site must pass authorization middleware");
  } finally {
    await app.close();
  }
});

test("P0 two-site transfer requires authorization for both source and destination", async () => {
  const app = await fixture();
  try {
    const denied = await request(app, "warehouse", "POST", "/api/v1/supply/movements", {
      lotId: "synthetic-lot", fromSiteId: "warehouse-site", toSiteId: "supplier-site", quantityMilli: 100, unit: "kg",
    });
    assert.equal(denied.status, 403, "authorization for only one side of a transfer is insufficient");
  } finally {
    await app.close();
  }
});

test("P0 site assignment grant requires an active enterprise member and a site-compatible active role", async () => {
  const app = await fixture();
  try {
    const nonMember = await request(app, "admin", "POST", "/api/v1/supply/sites/supplier-site/assignments", { userId: "not-an-enterprise-member" });
    assert.equal(nonMember.status, 400);
    assert.deepEqual(await nonMember.json(), { error: "user_not_active_enterprise_member" });

    const noRole = await request(app, "admin", "POST", "/api/v1/supply/sites/supplier-site/assignments", { userId: users.noRole });
    assert.equal(noRole.status, 400);
    assert.deepEqual(await noRole.json(), { error: "user_role_incompatible_with_site" });

    const suspended = await request(app, "admin", "POST", "/api/v1/supply/sites/supplier-site/assignments", { userId: users.suspended });
    assert.equal(suspended.status, 400);
    assert.deepEqual(await suspended.json(), { error: "user_not_active_enterprise_member" });

    const incompatibleRole = await request(app, "admin", "POST", "/api/v1/supply/sites/supplier-site/assignments", { userId: users.buyer });
    assert.equal(incompatibleRole.status, 400);
    assert.deepEqual(await incompatibleRole.json(), { error: "user_role_incompatible_with_site" });

    const valid = await request(app, "admin", "POST", "/api/v1/supply/sites/supplier-site/assignments", { userId: users.supplier });
    assert.equal(valid.status, 201);
    assert.deepEqual((await valid.json()).data, {
      tenantId: "ent-1", userId: users.supplier, siteId: "supplier-site", status: "active",
    });
  } finally {
    await app.close();
  }
});


test("P0 complete role-denial matrix covers every protected supply-chain and transaction read/mutation route", async () => {
  const app = await fixture();
  try {
    const roleTokens = ["admin","buyer","seller","supplier","warehouse","qc","logistics","auditor"];
    const matrix = [
      { method:"POST", route:"/api/v1/supply/sites", allowed:["admin"], body:{siteCode:"MATRIX-SITE",name:"Matrix Site",siteType:"warehouse",countryCode:"ID"} },
      { method:"POST", route:"/api/v1/supply/sites/supplier-site/assignments", allowed:["admin"], body:{userId:users.supplier} },
      { method:"DELETE", route:"/api/v1/supply/sites/supplier-site/assignments/p0-supplier", allowed:["admin"] },
      { method:"POST", route:"/api/v1/supply/lots", allowed:["admin","supplier","warehouse"], body:{siteId:"supplier-site",lotCode:"MATRIX-LOT",commodityName:"Synthetic coffee",quantityMilli:1000,unit:"kg"} },
      { method:"POST", route:"/api/v1/supply/lots/matrix-lot/inspections", allowed:["admin","qc"], body:{siteId:"supplier-site",inspectionType:"receiving",result:"pass"} },
      { method:"POST", route:"/api/v1/supply/processing", allowed:["admin","warehouse"], body:{siteId:"warehouse-site",inputs:[],outputs:[]} },
      { method:"POST", route:"/api/v1/supply/movements", allowed:["admin","warehouse","logistics"], body:{lotId:"matrix-lot",fromSiteId:"warehouse-site",toSiteId:"supplier-site",quantityMilli:100,unit:"kg"} },
      { method:"GET", route:"/api/v1/supply/stock?siteId=supplier-site", allowed:["admin","buyer","warehouse","qc","logistics","auditor"] },
      { method:"GET", route:"/api/v1/supply/lots/matrix-lot/trace", allowed:["admin","buyer","seller","warehouse","qc","logistics","auditor"] },
      { method:"POST", route:"/api/v1/supply/handovers", allowed:["admin","warehouse","logistics"], body:{lotId:"matrix-lot",fromSiteId:"warehouse-site",toSiteId:"supplier-site",quantityMilli:100,unit:"kg",handoverCode:"MATRIX-HO"} },
      { method:"POST", route:"/api/v1/supply/handovers/matrix-handover/dispatch", allowed:["admin","logistics"], body:{} },
      { method:"POST", route:"/api/v1/supply/handovers/matrix-handover/receive", allowed:["admin","warehouse","logistics","qc"], body:{receivedQuantityMilli:100} },
      { method:"POST", route:"/api/v1/transactions/matrix-tx/access-assignments", allowed:["admin"], body:{userId:users.supplier,role:"supplier",siteId:"supplier-site"} },
      { method:"DELETE", route:"/api/v1/transactions/matrix-tx/access-assignments/p0-supplier/supplier", allowed:["admin"] },
      { method:"POST", route:"/api/v1/transactions/matrix-tx/site-links", allowed:["admin"], body:{siteId:"supplier-site",purpose:"supplier_fulfilment"} },
    ];
    let assertions = 0;
    for (const item of matrix) {
      for (const role of roleTokens.filter((candidate) => !item.allowed.includes(candidate))) {
        const response = await request(app, role, item.method, item.route, item.body);
        assert.equal(response.status, 403, `${role} must be denied: ${item.method} ${item.route}; got ${response.status}: ${await response.clone().text()}`);
        assertions += 1;
      }
    }
    assert.ok(assertions >= 65, `expected broad role-denial coverage, got ${assertions} assertions`);
    for (const role of roleTokens) {
      const list = await request(app, role, "GET", "/api/v1/transactions");
      assert.equal(list.status, 200, `${role} role is eligible to enter the assignment-filtered transaction list`);
      const detail = await request(app, role, "GET", "/api/v1/transactions/missing-synthetic-transaction");
      assert.equal(detail.status, 404, `${role} without an assignment must not read a transaction detail`);
    }
  } finally {
    await app.close();
  }
});

test("P0 evidence entity role matrix denies roles outside each entity's server-side policy", async () => {
  const app = await fixture();
  try {
    const allRoles = ["admin","buyer","seller","supplier","warehouse","qc","logistics","auditor"];
    const matrix = [
      { entityType:"lot", allowed:["admin","supplier","warehouse"] },
      { entityType:"inspection", allowed:["admin","qc"] },
      { entityType:"movement", allowed:["admin","warehouse","logistics"] },
      { entityType:"handover", allowed:["admin","warehouse","logistics"] },
    ];
    for (const item of matrix) {
      for (const role of allRoles) {
        const response = await request(app, role, "POST", "/api/v1/supply/evidence", {
          entityType:item.entityType,entityId:"missing-synthetic-entity",evidenceType:"matrix-test",
          storageUri:"storage://synthetic/matrix-evidence",
        });
        const expected = item.allowed.includes(role) ? 404 : 403;
        assert.equal(response.status, expected, `${role} evidence policy for ${item.entityType}: expected ${expected}, got ${response.status}: ${await response.clone().text()}`);
      }
    }
  } finally {
    await app.close();
  }
});
