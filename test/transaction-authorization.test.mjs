import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer } from "../server/index.mjs";
import { migrateTenantIsolation } from "../scripts/migrate-tenant-isolation.mjs";

test("SEC-03 transaction reads require explicit assignment, role and site scope; audit is append-only", async () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"sec03-"));
  const ids={admin:"user-admin",buyer:"user-buyer",seller:"user-seller",supplier:"user-supplier",warehouse:"user-warehouse",qc:"user-qc",logistics:"user-logistics",auditor:"user-auditor"};
  const service=createServer({host:"127.0.0.1",port:0,singleEnterpriseId:"enterprise-1",supabaseUrl:"https://auth.example.test",supabaseAnonKey:"test",
    authFetcher:async(_url,init)=>{const token=init.headers.Authorization.replace(/^Bearer /,"").replace("token-","");return new Response(JSON.stringify({id:ids[token]??"unknown"}),{status:ids[token]?200:401});},
    dbPath:path.join(dir,"api.sqlite")});
  try{
    const started=await service.start(),base="http://127.0.0.1:"+started.port,db=service.db;
    migrateTenantIsolation(db);
    const now=new Date().toISOString();
    db.prepare("INSERT INTO tenants(id,tenant_type,display_name,created_at) VALUES('enterprise-1','seller','Enterprise',?)").run(now);
    const member=db.prepare("INSERT INTO tenant_memberships(tenant_id,user_id,role,created_at) VALUES('enterprise-1',?,?,?)");
    const role=db.prepare("INSERT INTO enterprise_role_assignments(enterprise_id,user_id,role,created_at) VALUES('enterprise-1',?,?,?)");
    for(const [key,user] of Object.entries(ids)){member.run(user,key==="buyer"?"buyer_member":"seller_member",now);role.run(user,key==="admin"?"enterprise_admin":key,now);}
    db.prepare("INSERT INTO tenants(id,tenant_type,display_name,created_at) VALUES('buyer-side','buyer','Buyer Side',?)").run(now);
    db.prepare("INSERT INTO tenants(id,tenant_type,display_name,created_at) VALUES('seller-side','seller','Seller Side',?)").run(now);
    db.prepare("INSERT INTO commercial_transactions(id,buyer_tenant_id,seller_tenant_id,status,created_at) VALUES('tx-1','buyer-side','enterprise-1','pending',?)").run(now);
    const sites={supplier:["site-supplier","supplier","supplier_fulfilment"],warehouse:["site-warehouse","warehouse","warehouse"],qc:["site-qc","packing_house","qc"],logistics:["site-logistics","port_terminal","logistics"]};
    const grant=db.prepare("INSERT INTO transaction_access_assignments(tenant_id,transaction_id,user_id,role,site_id,status,granted_by,created_at) VALUES('enterprise-1','tx-1',?,?,?,'active','user-admin',?)");
    grant.run("user-buyer","buyer",null,now);grant.run("user-seller","seller",null,now);grant.run("user-auditor","auditor",null,now);
    for(const [role,[siteId,siteType,purpose]] of Object.entries(sites)){
      db.prepare("INSERT INTO supply_sites(id,tenant_id,site_code,name,site_type,active,created_at) VALUES(?,?,?,?,?,1,?)").run(siteId,"enterprise-1",siteId,role,siteType,now);
      db.prepare("INSERT INTO transaction_site_links(tenant_id,transaction_id,site_id,purpose,created_by,created_at) VALUES(?,?,?,?,?,?)").run("enterprise-1","tx-1",siteId,purpose,"user-admin",now);
      db.prepare("INSERT INTO supply_site_assignments(tenant_id,user_id,site_id,status,granted_by,created_at,updated_at) VALUES(?,?,?,'active',?,?,?)").run("enterprise-1","user-"+role,siteId,"user-admin",now,now);
      grant.run("user-"+role,role,siteId,now);
    }
    const request=(who,url="/api/v1/transactions/tx-1")=>fetch(base+url,{headers:{Authorization:"Bearer token-"+who}});
    const denied=await request("supplier");
    assert.equal(denied.status,404);
    const buyer=await (await request("buyer")).json();
    assert.equal(buyer.data.inquiryId,null);
    for(const role of ["supplier","warehouse","qc","logistics"]){
      const response=await request(role);
      assert.equal(response.status,200,role+" should have its explicitly assigned operational scope");
      const body=await response.json();
      assert.deepEqual(Object.keys(body.data).sort(),["createdAt","id","status"]);
    }
    const seller=await request("seller");
    assert.equal(seller.status,200);
    const auditor=await (await request("auditor")).json();
    assert.deepEqual(Object.keys(auditor.data).sort(),["createdAt","id","status"]);
    assert.equal((await request("admin")).status,200);
    const events=db.prepare("SELECT action,outcome FROM supply_audit_events WHERE entity_id='tx-1'").all();
    assert.ok(events.some(e=>e.outcome==="denied"));
    assert.ok(events.some(e=>e.outcome==="success"));
    assert.throws(()=>db.prepare("DELETE FROM supply_audit_events WHERE entity_id='tx-1'").run(),/supply_audit_events_are_append_only/);
  }finally{await service.close();fs.rmSync(dir,{recursive:true,force:true});}
});
