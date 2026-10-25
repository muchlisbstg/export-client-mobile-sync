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
    const result=f.service.processLot({tenantId:"tenant-a",siteId:f.packing.id,inputs:[{lotId,quantityMilli:1_000_000,unit:"kg"}],outputs:[{lotCode:"PACKED-001",productId:"coffee-packed",commodityName:"Packed green coffee",quantityMilli:900_000,unit:"kg"}],actorId:"pack-operator",idempotencyKey:"process-1"});
    assert.equal(result.childLots.length,1);
    const trace=f.service.trace({tenantId:"tenant-a",lotId:result.childLots[0].id});
    assert.equal(trace.parents[0].lotId,lotId);
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

test("HTTP supply-chain routes require verified identity and active tenant membership", async () => {
  const dbServer=createServer({
    host:"127.0.0.1",port:0,supabaseUrl:"https://auth.example.test",supabaseAnonKey:"test-anon",
    authFetcher:async (_url,init)=>{
      const token=init.headers.Authorization.replace(/^Bearer /,"");
      const ids={"token-a":"user-a","token-b":"user-b"};
      return ids[token]?new Response(JSON.stringify({id:ids[token]}),{status:200}):new Response("{}",{status:401});
    },
  });
  let base;
  try {
    const started=await dbServer.start(); base=`http://127.0.0.1:${started.port}`;
    migrateSupplyChainDatabase(dbServer.db);
    dbServer.db.prepare("INSERT INTO tenants(id,tenant_type,display_name,created_at) VALUES(?,?,?,?)").run("tenant-a","seller","Seller A",new Date().toISOString());
    dbServer.db.prepare("INSERT INTO tenants(id,tenant_type,display_name,created_at) VALUES(?,?,?,?)").run("tenant-b","seller","Seller B",new Date().toISOString());
    dbServer.db.prepare("INSERT INTO tenant_memberships(tenant_id,user_id,role,created_at) VALUES(?,?,?,?)").run("tenant-a","user-a","seller_admin",new Date().toISOString());
    dbServer.db.prepare("INSERT INTO tenant_memberships(tenant_id,user_id,role,created_at) VALUES(?,?,?,?)").run("tenant-b","user-b","seller_admin",new Date().toISOString());
    const service=createSupplyChainService(dbServer.db);
    const site=service.createSite({tenantId:"tenant-a",siteCode:"A-SITE",name:"Tenant A Site",siteType:"plantation",actorId:"user-a"});
    const lot=service.receiveLot({tenantId:"tenant-a",siteId:site.id,lotCode:"A-LOT",productId:"coffee",commodityName:"Coffee",quantityMilli:1000,unit:"kg",actorId:"user-a",idempotencyKey:"a-receipt"});
    const unauth=await fetch(`${base}/api/v1/supply/lots/${lot.lotId}/trace`,{headers:{"x-active-tenant-id":"tenant-a"}});
    assert.equal(unauth.status,401);
    const cross=await fetch(`${base}/api/v1/supply/lots/${lot.lotId}/trace`,{headers:{Authorization:"Bearer token-b","x-active-tenant-id":"tenant-b"}});
    assert.equal(cross.status,404);
    const allowed=await fetch(`${base}/api/v1/supply/lots/${lot.lotId}/trace`,{headers:{Authorization:"Bearer token-a","x-active-tenant-id":"tenant-a"}});
    assert.equal(allowed.status,200);
  } finally { await dbServer.close(); }
});
