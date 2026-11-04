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
    const assignedRole = ({admin:"enterprise_admin",supplier:"supplier",warehouse:"warehouse",qc:"qc",buyer:"buyer",unassigned:"supplier",suspended:"supplier"})[token];
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
  assign.run(users.buyer, "buyer-site", "active", now, now).catch?.(() => {});
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
