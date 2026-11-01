import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import express from "express";
import http from "node:http";
import { createEnterpriseAuthorization } from "../server/authorization.mjs";

function fixture() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE inquiries (
      id TEXT PRIMARY KEY,
      buyer_tenant_id TEXT,
      seller_tenant_id TEXT,
      tenant_migration_state TEXT NOT NULL DEFAULT 'unassigned'
    );
    CREATE TABLE tenants (
      id TEXT PRIMARY KEY,
      tenant_type TEXT NOT NULL,
      display_name TEXT NOT NULL,
      status TEXT NOT NULL
    );
    CREATE TABLE tenant_memberships (
      tenant_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL
    );
    CREATE TABLE enterprise_role_assignments (
      enterprise_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL
    );
    CREATE TABLE commercial_transactions (id TEXT PRIMARY KEY);
    INSERT INTO tenants VALUES ('enterprise-1','seller','Enterprise One','active');
    INSERT INTO tenant_memberships VALUES ('enterprise-1','user-1','seller_admin','active');
    INSERT INTO enterprise_role_assignments VALUES ('enterprise-1','user-1','warehouse','active');
    INSERT INTO enterprise_role_assignments VALUES ('enterprise-1','user-1','qc','revoked');
  `);
  return db;
}

async function start(db, identity = { id: "user-1" }) {
  const policy = createEnterpriseAuthorization({ db, singleEnterpriseId: "enterprise-1" });
  const app = express();
  app.get("/private", (req, res, next) => {
    if (identity) res.locals.authIdentity = identity;
    next();
  }, policy.requireActiveEnterprise, policy.requireEnterpriseRole("warehouse"), (_req, res) => {
    res.json({ enterpriseId: res.locals.activeTenant.id, roles: res.locals.activeTenant.roles });
  });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

test("active membership receives only active, recognized enterprise roles", () => {
  const db = fixture();
  try {
    const policy = createEnterpriseAuthorization({ db, singleEnterpriseId: "enterprise-1" });
    assert.deepEqual(policy.resolveEnterpriseMembership("user-1").roles, ["warehouse"]);
  } finally {
    db.close();
  }
});

test("private route permits an active member with the required role", async () => {
  const db = fixture();
  const app = await start(db);
  try {
    const response = await fetch(`${app.url}/private`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { enterpriseId: "enterprise-1", roles: ["warehouse"] });
  } finally {
    await app.close();
    db.close();
  }
});

test("forged enterprise context is rejected", async () => {
  const db = fixture();
  const app = await start(db);
  try {
    const response = await fetch(`${app.url}/private`, { headers: { "x-active-tenant-id": "enterprise-attacker" } });
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: "enterprise_context_locked" });
  } finally {
    await app.close();
    db.close();
  }
});

test("missing authenticated identity is rejected", async () => {
  const db = fixture();
  const app = await start(db, null);
  try {
    const response = await fetch(`${app.url}/private`);
    assert.equal(response.status, 401);
  } finally {
    await app.close();
    db.close();
  }
});

test("revoked membership and revoked roles do not authorize access", async () => {
  const db = fixture();
  db.prepare("UPDATE tenant_memberships SET status='revoked' WHERE user_id='user-1'").run();
  const app = await start(db);
  try {
    const response = await fetch(`${app.url}/private`);
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: "enterprise_access_denied" });
  } finally {
    await app.close();
    db.close();
  }
});

test("unknown role names cannot be used to construct an authorization grant", async () => {
  const db = fixture();
  const policy = createEnterpriseAuthorization({ db, singleEnterpriseId: "enterprise-1" });
  const response = await new Promise((resolve) => {
    const res = {
      locals: {},
      status(code) { this.statusCode = code; return this; },
      json(body) { resolve({ status: this.statusCode, body }); },
    };
    policy.requireEnterpriseRole("platform_superuser")({}, res, () => resolve({ status: 200 }));
  });
  assert.equal(response.status, 403);
  db.close();
});
