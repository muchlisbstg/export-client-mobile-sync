import assert from 'node:assert/strict';
import pg from 'pg';
import fs from 'node:fs';
const {Client}=pg;
const admin=new Client({connectionString:process.env.PG_ADMIN_URL});
await admin.connect();
const role=new Client({connectionString:process.env.PG_API_URL});
await role.connect();
const results=[];
async function as(tenant,user,fn){
  await role.query('BEGIN');
  try {
    await role.query("SELECT set_config('app.tenant_id',$1,true), set_config('app.user_id',$2,true)",[tenant||'',user||'']);
    const value=await fn();
    await role.query('COMMIT');
    return value;
  } catch(e){ await role.query('ROLLBACK'); throw e; }
}
async function test(id,fn){try{await fn();results.push({id,status:'PASS'});}catch(e){results.push({id,status:'FAIL',error:e.message});}}
const roleInfo=await admin.query("SELECT rolsuper,rolbypassrls,rolcreaterole FROM pg_roles WHERE rolname='app_api'");
assert.equal(roleInfo.rows[0].rolsuper,false); assert.equal(roleInfo.rows[0].rolbypassrls,false);
await test('RLS-001',async()=>assert.equal((await as('tenant-a','user-a',()=>role.query("SELECT * FROM audit_events WHERE id='audit-s'"))).rows.length,0));
await test('RLS-002',async()=>assert.equal((await as('tenant-a','user-a',()=>role.query("SELECT * FROM commercial_transactions WHERE id='tx-1'"))).rows.length,1));
await test('RLS-003',async()=>{await assert.rejects(()=>as('tenant-a','user-a',()=>role.query("INSERT INTO tenants VALUES ('tenant-forged')")));});
await test('RLS-004',async()=>assert.equal((await as('tenant-a','user-old',()=>role.query("SELECT * FROM tenant_memberships WHERE id='member-revoked' AND status='active'"))).rows.length,0));
await test('RLS-005',async()=>assert.equal((await as('tenant-a','user-a',()=>role.query("SELECT * FROM transaction_participants WHERE id='part-pending'"))).rows.length,0));
await test('RLS-006',async()=>assert.equal((await as('tenant-s','user-s',()=>role.query("SELECT * FROM transaction_site_links WHERE id='link-a'"))).rows.length,0));
await test('RLS-007',async()=>{await assert.rejects(()=>as('tenant-a','user-a',()=>role.query("INSERT INTO transaction_access_assignments VALUES ('bad-membership','tenant-a','tx-1','part-a','site-a','link-a','member-b','active')")));});
await test('RLS-008',async()=>{await assert.rejects(()=>as('tenant-a','user-a',()=>role.query("INSERT INTO transaction_access_assignments VALUES ('bad-link','tenant-a','tx-1','part-a','site-b','link-a','member-a','active')")));});
await test('RLS-009',async()=>assert.equal((await as('tenant-a','user-a',()=>role.query("SELECT * FROM permission_actions WHERE code='not.granted'"))).rows.length,0));
await test('RLS-010',async()=>assert.equal((await as('tenant-s','user-s',()=>role.query("SELECT * FROM transaction_access_assignment_actions WHERE assignment_id='assign-a'"))).rows.length,0));
await test('RLS-011',async()=>assert.equal((await as('tenant-s','user-s',()=>role.query("SELECT * FROM transaction_access_assignment_actions WHERE assignment_id='assign-a' AND action_code='payment.approve'"))).rows.length,0));
await test('RLS-012',async()=>assert.equal((await as('tenant-s','user-s',()=>role.query("SELECT * FROM transaction_access_assignment_actions WHERE assignment_id='assign-a' AND action_code='goods.release'"))).rows.length,0));
await test('RLS-013',async()=>assert.equal((await as('tenant-a','user-a',()=>role.query("SELECT a.* FROM audit_events a JOIN tenants t ON t.id=a.tenant_id WHERE a.id='audit-s'"))).rows.length,0));
await test('RLS-014',async()=>assert.equal((await as(null,null,()=>role.query("SELECT * FROM tenants"))).rows.length,0));
await test('RLS-015',async()=>{await as('tenant-a','user-a',()=>role.query("SELECT * FROM audit_events"));assert.equal((await as(null,null,()=>role.query("SELECT * FROM audit_events"))).rows.length,0);});
// RLS-016 is excluded from this database-only suite. API provenance remains GH-09.
// Membership must gate every tenant-scoped read surface, not merely writes.
await test('RLS-022',async()=>assert.equal((await as('tenant-a','user-ghost',()=>role.query("SELECT * FROM tenants"))).rows.length,0));
await test('RLS-023',async()=>assert.equal((await as('tenant-a','user-ghost',()=>role.query("SELECT * FROM supply_sites"))).rows.length,0));
await test('RLS-024',async()=>assert.equal((await as('tenant-a','user-ghost',()=>role.query("SELECT * FROM commercial_transactions"))).rows.length,0));
await test('RLS-025',async()=>assert.equal((await as('tenant-a','user-ghost',()=>role.query("SELECT * FROM transaction_participants"))).rows.length,0));
await test('RLS-026',async()=>assert.equal((await as('tenant-a','user-ghost',()=>role.query("SELECT * FROM transaction_site_links"))).rows.length,0));
await test('RLS-027',async()=>assert.equal((await as('tenant-a','user-ghost',()=>role.query("SELECT * FROM audit_events"))).rows.length,0));
await test('RLS-028',async()=>assert.equal((await as('tenant-a','user-a2',()=>role.query("SELECT * FROM transaction_access_assignment_actions WHERE assignment_id='assign-a'"))).rows.length,0));
await test('RLS-029',async()=>{await assert.rejects(()=>as('tenant-a','user-a',()=>role.query("INSERT INTO transaction_access_assignment_actions VALUES ('assign-a','contract.approve')")));});
await test('RLS-030',async()=>{await assert.rejects(()=>as('tenant-a','user-a',()=>role.query("UPDATE transaction_access_assignment_actions SET action_code='goods.release' WHERE assignment_id='assign-a' AND action_code='site.inspect'")));});
await test('RLS-031',async()=>{await assert.rejects(()=>as('tenant-a','user-a',()=>role.query("DELETE FROM transaction_access_assignment_actions WHERE assignment_id='assign-a' AND action_code='site.inspect'")));});

await test('RLS-019',async()=>{await assert.rejects(()=>as('tenant-a','user-a',()=>role.query("INSERT INTO tenant_memberships VALUES ('forged-member','tenant-a','user-b','active')")));});
await test('RLS-020',async()=>{await assert.rejects(()=>as('tenant-a','user-old',()=>role.query("INSERT INTO transaction_participants VALUES ('forged-part','tenant-a','tx-2','supplier','active')")));});
await test('RLS-021',async()=>{await assert.rejects(()=>as('tenant-a','user-a',()=>role.query("INSERT INTO transaction_site_links VALUES ('forged-link','tenant-a','tx-1','part-b','site-a','active')")));});
await test('RLS-017',async()=>{await assert.rejects(()=>as('tenant-a','user-a',()=>role.query("DELETE FROM audit_events WHERE id='audit-a'")));});
await test('RLS-032',async()=>{await assert.rejects(()=>as('tenant-a','user-a',()=>role.query("UPDATE audit_events SET event_type='tampered' WHERE id='audit-a'")));});
await test('RLS-018',async()=>assert.equal((await as('tenant-a','user-a',()=>role.query("SELECT * FROM (SELECT * FROM audit_events) q WHERE id='audit-s'"))).rows.length,0));
await role.end(); await admin.end();
console.log(JSON.stringify({suite:'GH-05 disposable PostgreSQL RLS only',role:'app_api',results,passed:results.filter(x=>x.status==='PASS').length,failed:results.filter(x=>x.status==='FAIL').length,context_provenance:'NOT_VERIFIED: app_api can set custom app.tenant_id/app.user_id; GH-09 signed/verified identity provenance remains a separate required gate'},null,2));
if(results.some(x=>x.status!=='PASS')) process.exitCode=1;
