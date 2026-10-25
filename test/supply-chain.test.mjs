import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { migrateSupplyChainDatabase } from "../scripts/migrate-supply-chain.mjs";
import { createSupplyChainService, SupplyChainError } from "../server/supply-chain.mjs";
import { createServer } from "../server/index.mjs";

function fixture() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE products (id TEXT PRIMARY KEY);
    CREATE TABLE inquiries (id TEXT PRIMARY KEY, tracking_code TEXT NOT NULL UNIQUE, customer_email TEXT NOT NULL, origin_node_id TEXT NOT NULL DEFAULT 'legacy');
  `);
  migrateSupplyChainDatabase(db);
  db.prepare("INSERT INTO tenants(id,tenant_type,display_name,created_at) VALUES(?,?,?,?)").run("tenant-a","seller","Seller A",new Date().toISOString());
  db.prepare("INSERT INTO tenants(id,tenant_type,display_name,created_at) VALUES(?,?,?,?)").run("tenant-b","seller","Seller B",new Date().toISOString());
  const service=createSupplyChainService(db);
  const plantation=service.createSite({tenantId:"tenant-a",siteCode:"FARM-1",name:"Farm 1",siteType:"plantation",actorId:"user-a"});
  const packing=service.createSite({tenantId:"tenant-a",siteCode:"PACK-1",name:"Packing House 1",siteType:"packing_house",actorId:"user-a"});
  const warehouse=service.createSite({tenantId:"tenant-a",siteCode:"WH-1",name:"Warehouse 1",siteType:"warehouse",actorId:"user-a"});
  const port=service.createSite({tenantId:"tenant-a",siteCode:"PORT-1",name:"Port Terminal",siteType:"port_terminal",actorId:"user-a"});
  const other=service.createSite({tenantId:"tenant-b",siteCode:"OTHER-1",name:"Other Tenant Site",siteType:"warehouse",actorId:"user-b"});
  const receive=(opts={})=>service.receiveLot({
    tenantId:"tenant-a",siteId:opts.siteId??plantation.id,lotCode:opts.lotCode??"LOT-001",
    productId:"coffee",commodityName:"Green coffee",quantityMilli:opts.quantityMilli??1_000_000,unit:"kg",
    actorId:"user-a",idempotencyKey:opts.idempotencyKey??"receipt-1",originEvidenceRef:"evidence://origin",
  });
  const pass=(lotId,siteId=plantation.id)=>service.inspectLot({tenantId:"tenant-a",lotId,siteId,inspectionType:"receiving",result:"pass",actorId:"quality-a",criteria:{moistureMax:12},evidenceRef:"evidence://inspection"});
  return {db,service,plantation,packing,warehouse,port,other,receive,pass};
}

test("supply-chain migration is idempotent and preserves legacy ownership as unassigned", () => {
  const {db}=fixture();
  try {
    assert.doesNotThrow(()=>migrateSupplyChainDatabase(db));
    for(const table of ["supply_sites","supply_lots","lot_genealogy","inventory_movements","inventory_entries","quality_inspections","handovers","supply_evidence"]) {
      assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table),table);
    }
    assert.deepEqual(db.prepare("PRAGMA integrity_check").all(),[{integrity_check:"ok"}]);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(),[]);
    assert.equal(db.prepare("SELECT tenant_migration_state FROM inquiries").all().length,0);
  } finally { db.close(); }
});

test("receipt retry returns the same lot and does not double stock", () => {
  const f=fixture();
  try {
    const first=f.receive();
    const retry=f.receive();
    assert.equal(retry.duplicate,true);
    assert.equal(retry.lotId,first.lotId);
    assert.equal(f.service.stock({tenantId:"tenant-a",siteId:f.plantation.id}).find(x=>x.lotId===first.lotId).quantityMilli,1_000_000);
    assert.throws(()=>f.service.receiveLot({tenantId:"tenant-a",siteId:f.plantation.id,lotCode:"LOT-OTHER",productId:"coffee",commodityName:"Green coffee",quantityMilli:1_000_000,unit:"kg",actorId:"user-a",idempotencyKey:"receipt-1"}),e=>e instanceof SupplyChainError&&e.code==="idempotency_conflict");
  } finally { f.db.close(); }
});

test("concurrent transfers serialize and cannot make stock negative", () => {
  const f=fixture();
  try {
    const {lotId}=f.receive({quantityMilli:2_000_000});
    f.pass(lotId);
    const outcomes=[1,2].map(n=>{try{return f.service.moveStock({tenantId:"tenant-a",lotId,fromSiteId:f.plantation.id,toSiteId:f.warehouse.id,quantityMilli:1_500_000,unit:"kg",actorId:"user-a",idempotencyKey:`transfer-${n}`})}catch(e){return e}});
    assert.equal(outcomes.filter(x=>x instanceof SupplyChainError&&x.code==="insufficient_stock").length,1);
    const stock=f.service.stock({tenantId:"tenant-a",siteId:f.plantation.id}).find(x=>x.lotId===lotId);
    assert.equal(stock.quantityMilli,500_000);
    assert.ok(stock.quantityMilli>=0);
  } finally { f.db.close(); }
});

test("failed stock posting rolls back movement and entries", () => {
  const f=fixture();
  try {
    const {lotId}=f.receive({quantityMilli:100_000});
    f.pass(lotId);
    assert.throws(()=>f.service.moveStock({tenantId:"tenant-a",lotId,fromSiteId:f.plantation.id,toSiteId:f.warehouse.id,quantityMilli:200_000,unit:"kg",actorId:"user-a",idempotencyKey:"too-much"}),e=>e instanceof SupplyChainError&&e.code==="insufficient_stock");
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM inventory_movements WHERE idempotency_key='too-much'").get().n,0);
    assert.equal(f.service.stock({tenantId:"tenant-a",siteId:f.plantation.id}).find(x=>x.lotId===lotId).quantityMilli,100_000);
  } finally { f.db.close(); }
});

test("held lots cannot be dispatched", () => {
  const f=fixture();
  try {
    const {lotId}=f.receive();
    f.service.inspectLot({tenantId:"tenant-a",lotId,siteId:f.plantation.id,inspectionType:"receiving",result:"hold",actorId:"quality-a"});
    assert.throws(()=>f.service.prepareHandover({tenantId:"tenant-a",lotId,fromSiteId:f.plantation.id,toSiteId:f.port.id,quantityMilli:10_000,unit:"kg",actorId:"user-a",idempotencyKey:"handover-hold",handoverCode:"H-001"}),e=>e instanceof SupplyChainError&&e.code==="lot_not_released");
  } finally { f.db.close(); }
});

test("packing-house processing creates child lot genealogy atomically", () => {
  const f=fixture();
  try {
    const {lotId}=f.receive({siteId:f.packing.id,quantityMilli:1_000_000});
    f.pass(lotId,f.packing.id);
    const result=f.service.processLot({tenantId:"tenant-a",siteId:f.packing.id,inputs:[{lotId,quantityMilli:1_000_000,unit:"kg"}],outputs:[{lotCode:"PACKED-001",productId:"coffee-packed",commodityName:"Packed green coffee",quantityMilli:900_000,unit:"kg"}],lossQuantityMilli:100_000,lossReason:"sorting_rejects",actorId:"pack-operator",idempotencyKey:"process-1"});
    assert.equal(result.childLots.length,1);
    const trace=f.service.trace({tenantId:"tenant-a",lotId:result.childLots[0].id});
    assert.equal(trace.parents[0].lotId,lotId);
    assert.equal(trace.losses.length,0);
    assert.equal(f.service.trace({tenantId:"tenant-a",lotId:lotId}).losses[0].quantityMilli,100_000);
    assert.equal(f.service.stock({tenantId:"tenant-a",siteId:f.packing.id}).find(x=>x.lotId===lotId).quantityMilli,0);
  } finally { f.db.close(); }
});

test("handover receipt discrepancy is recorded rather than silently accepted", () => {
  const f=fixture();
  try {
    const {lotId}=f.receive();
    f.pass(lotId);
    const h=f.service.prepareHandover({tenantId:"tenant-a",lotId,fromSiteId:f.plantation.id,toSiteId:f.port.id,quantityMilli:200_000,unit:"kg",actorId:"dispatch-user",idempotencyKey:"handover-1",handoverCode:"HAND-1",sealNumber:"SEAL-1"});
    const sent=f.service.dispatchHandover({tenantId:"tenant-a",handoverId:h.id,actorId:"dispatch-user",idempotencyKey:"dispatch-1"});
    assert.equal(sent.status,"dispatched");
    const received=f.service.receiveHandover({tenantId:"tenant-a",handoverId:h.id,receivedQuantityMilli:190_000,actorId:"port-user",sealNumber:"SEAL-1"});
    assert.equal(received.status,"discrepancy");
    assert.match(received.discrepancyNote,/expected_quantity_milli=200000/);
  } finally { f.db.close(); }
});

test("cross-tenant lot and site access are denied", () => {
  const f=fixture();
  try {
    const {lotId}=f.receive();
    assert.throws(()=>f.service.trace({tenantId:"tenant-b",lotId}),e=>e instanceof SupplyChainError&&e.status===404&&e.code==="lot_not_found");
    assert.throws(()=>f.service.stock({tenantId:"tenant-b",siteId:f.plantation.id}),e=>e instanceof SupplyChainError&&e.status===404&&e.code==="site_not_found");
    assert.throws(()=>f.service.moveStock({tenantId:"tenant-b",lotId,fromSiteId:f.other.id,toSiteId:f.other.id,quantityMilli:1,unit:"kg",actorId:"user-b",idempotencyKey:"x"}),e=>e instanceof SupplyChainError&&e.status===400);
  } finally { f.db.close(); }
});

test("single-enterprise RBAC restricts Buyer, Seller, Supplier, Warehouse, QC and outsiders", async () => {
  const roleUsers = {
    "token-admin": "user-admin",
    "token-buyer": "user-buyer",
    "token-seller": "user-seller",
    "token-supplier": "user-supplier",
    "token-warehouse": "user-warehouse",
    "token-qc": "user-qc",
    "token-outsider": "user-outsider",
  };
  const dbServer=createServer({
    host:"127.0.0.1",port:0,singleEnterpriseId:"enterprise-1",
    supabaseUrl:"https://auth.example.test",supabaseAnonKey:"test-anon",
    authFetcher:async (_url,init)=>{
      const token=init.headers.Authorization.replace(/^Bearer /,"");
      return roleUsers[token]
        ? new Response(JSON.stringify({id:roleUsers[token]}),{status:200})
        : new Response("{}",{status:401});
    },
  });
  let base;
  try {
    const started=await dbServer.start(); base=`http://127.0.0.1:${started.port}`;
    migrateSupplyChainDatabase(dbServer.db);
    const now=new Date().toISOString();
    dbServer.db.prepare("INSERT INTO tenants(id,tenant_type,display_name,created_at) VALUES(?,?,?,?)").run("enterprise-1","seller","Single Enterprise",now);
    dbServer.db.prepare("INSERT INTO tenants(id,tenant_type,display_name,created_at) VALUES(?,?,?,?)").run("other-enterprise","buyer","Other Enterprise",now);
    const insertMembership=dbServer.db.prepare("INSERT INTO tenant_memberships(tenant_id,user_id,role,created_at) VALUES(?,?,?,?)");
    const insertRole=dbServer.db.prepare("INSERT INTO enterprise_role_assignments(enterprise_id,user_id,role,created_at) VALUES(?,?,?,?)");
    for (const [user,role] of [
      ["user-admin","seller_admin"],["user-buyer","buyer_member"],["user-seller","seller_member"],
      ["user-supplier","seller_member"],["user-warehouse","seller_member"],["user-qc","seller_member"],
    ]) {
      insertMembership.run("enterprise-1",user,role,now);
    }
    insertMembership.run("other-enterprise","user-outsider","buyer_member",now);
    for (const [user,role] of [
      ["user-admin","enterprise_admin"],["user-buyer","buyer"],["user-seller","seller"],
      ["user-supplier","supplier"],["user-warehouse","warehouse"],["user-qc","qc"],
    ]) insertRole.run("enterprise-1",user,role,now);

    const service=createSupplyChainService(dbServer.db);
    const site=service.createSite({tenantId:"enterprise-1",siteCode:"WH-1",name:"Main Warehouse",siteType:"warehouse",actorId:"user-admin"});
    const supplierSite=service.createSite({tenantId:"enterprise-1",siteCode:"SUP-1",name:"Supplier Intake",siteType:"supplier",actorId:"user-admin"});
    const lot=service.receiveLot({tenantId:"enterprise-1",siteId:site.id,lotCode:"LOT-1",productId:"coffee",commodityName:"Coffee",quantityMilli:1000,unit:"kg",actorId:"user-admin",idempotencyKey:"seed-lot"});
    const headers=(token)=>({Authorization:`Bearer ${token}`});
    const request=(token,path,init={})=>fetch(`${base}${path}`,{...init,headers:{...headers(token),...(init.headers??{})}});

    const noAuth=await fetch(`${base}/api/v1/supply/lots/${lot.lotId}/trace`);
    assert.equal(noAuth.status,401);

    const enterpriseSession=await request("token-buyer","/api/v1/enterprise/session");
    assert.equal(enterpriseSession.status,200);
    const sessionBody=await enterpriseSession.json();
    assert.equal(sessionBody.enterprise.id,"enterprise-1");
    assert.deepEqual(sessionBody.roles,["buyer"]);

    const buyerStock = await request("token-buyer",`/api/v1/supply/stock?siteId=${encodeURIComponent(site.id)}`);
    assert.equal(buyerStock.status,200,await buyerStock.clone().text());
    assert.equal((await request("token-seller",`/api/v1/supply/lots/${lot.lotId}/trace`)).status,200);
    assert.equal((await request("token-supplier",`/api/v1/supply/stock?siteId=${site.id}`)).status,403);
    assert.equal((await request("token-warehouse",`/api/v1/supply/stock?siteId=${site.id}`)).status,200);
    assert.equal((await request("token-qc",`/api/v1/supply/stock?siteId=${site.id}`)).status,200);

    const deniedInspection=await request("token-buyer",`/api/v1/supply/lots/${lot.lotId}/inspections`,{
      method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({siteId:site.id,inspectionType:"receiving",result:"pass"}),
    });
    assert.equal(deniedInspection.status,403);
    const qcInspection=await request("token-qc",`/api/v1/supply/lots/${lot.lotId}/inspections`,{
      method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({siteId:site.id,inspectionType:"receiving",result:"pass"}),
    });
    assert.equal(qcInspection.status,201);

    const supplierWarehouseWrite=await request("token-supplier","/api/v1/supply/lots",{
      method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":"supplier-lot-warehouse-denied"},
      body:JSON.stringify({siteId:site.id,lotCode:"SUPPLIER-LOT-DENIED",productId:"coffee",commodityName:"Coffee",quantityMilli:500,unit:"kg"}),
    });
    assert.equal(supplierWarehouseWrite.status,403);
    const supplierLot=await request("token-supplier","/api/v1/supply/lots",{
      method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":"supplier-lot-1"},
      body:JSON.stringify({siteId:supplierSite.id,lotCode:"SUPPLIER-LOT-1",productId:"coffee",commodityName:"Coffee",quantityMilli:500,unit:"kg"}),
    });
    assert.equal(supplierLot.status,201);

    const deniedSiteCreation=await request("token-seller","/api/v1/supply/sites",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({siteCode:"NOPE",name:"Not allowed",siteType:"warehouse"}),
    });
    assert.equal(deniedSiteCreation.status,403);
    const adminSiteCreation=await request("token-admin","/api/v1/supply/sites",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({siteCode:"WH-2",name:"Secondary Warehouse",siteType:"warehouse"}),
    });
    assert.equal(adminSiteCreation.status,201);

    const switchedEnterprise=await request("token-buyer",`/api/v1/supply/stock?siteId=${site.id}`,{
      headers:{"x-active-tenant-id":"other-enterprise"},
    });
    assert.equal(switchedEnterprise.status,403);
    const outsider=await request("token-outsider","/api/v1/enterprise/session");
    assert.equal(outsider.status,403);
  } finally { await dbServer.close(); }
});
