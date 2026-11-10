import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import Database from 'better-sqlite3';
import pg from 'pg';
const {Client}=pg;
const pgClient=new Client({connectionString:process.env.PG_ADMIN_URL});
await pgClient.connect();
const sqlite=new Database(':memory:');
sqlite.pragma('foreign_keys = ON');
const pgDdl=[
`CREATE TEMP TABLE tenants(id text PRIMARY KEY)`,
`CREATE TEMP TABLE legal_parties(id text PRIMARY KEY)`,
`CREATE TEMP TABLE tenant_legal_party_bindings(id text PRIMARY KEY,tenant_id text NOT NULL REFERENCES tenants(id),legal_party_id text NOT NULL REFERENCES legal_parties(id),effective_from text NOT NULL,effective_to text,version integer NOT NULL,UNIQUE(id,tenant_id,legal_party_id),UNIQUE(tenant_id,version),CHECK(effective_to IS NULL OR effective_to>effective_from))`,
`CREATE TEMP TABLE commercial_transactions(id text PRIMARY KEY,buyer_party_id text NOT NULL,seller_party_id text NOT NULL,CHECK(buyer_party_id<>seller_party_id))`,
`CREATE TEMP TABLE transaction_participants(id text PRIMARY KEY,tenant_id text NOT NULL REFERENCES tenants(id),transaction_id text NOT NULL REFERENCES commercial_transactions(id),legal_party_id text NOT NULL,binding_id text NOT NULL,role text NOT NULL CHECK(role IN ('buyer','seller','supplier')),status text NOT NULL CHECK(status IN ('pending','active','suspended','revoked','expired')),UNIQUE(tenant_id,transaction_id),UNIQUE(id,tenant_id,transaction_id),FOREIGN KEY(binding_id,tenant_id,legal_party_id) REFERENCES tenant_legal_party_bindings(id,tenant_id,legal_party_id))`,
`CREATE UNIQUE INDEX uq_buyer_seller_role ON transaction_participants(transaction_id,role) WHERE role IN ('buyer','seller')`,
`CREATE TEMP TABLE tenant_memberships(id text PRIMARY KEY,tenant_id text NOT NULL REFERENCES tenants(id),user_id text NOT NULL,status text NOT NULL,UNIQUE(id,tenant_id))`,
`CREATE TEMP TABLE supply_sites(id text NOT NULL,tenant_id text NOT NULL REFERENCES tenants(id),PRIMARY KEY(id,tenant_id))`,
`CREATE TEMP TABLE transaction_site_links(id text PRIMARY KEY,tenant_id text NOT NULL,transaction_id text NOT NULL,participant_id text NOT NULL,site_id text NOT NULL,status text NOT NULL,UNIQUE(id,tenant_id,transaction_id,participant_id,site_id),FOREIGN KEY(participant_id,tenant_id,transaction_id) REFERENCES transaction_participants(id,tenant_id,transaction_id),FOREIGN KEY(site_id,tenant_id) REFERENCES supply_sites(id,tenant_id))`,
`CREATE TEMP TABLE transaction_access_assignments(id text PRIMARY KEY,tenant_id text NOT NULL,transaction_id text NOT NULL,participant_id text NOT NULL,site_id text NOT NULL,site_link_id text NOT NULL,membership_id text NOT NULL,FOREIGN KEY(participant_id,tenant_id,transaction_id) REFERENCES transaction_participants(id,tenant_id,transaction_id),FOREIGN KEY(site_id,tenant_id) REFERENCES supply_sites(id,tenant_id),FOREIGN KEY(site_link_id,tenant_id,transaction_id,participant_id,site_id) REFERENCES transaction_site_links(id,tenant_id,transaction_id,participant_id,site_id),FOREIGN KEY(membership_id,tenant_id) REFERENCES tenant_memberships(id,tenant_id))`,
`CREATE TEMP TABLE audit_events(id text PRIMARY KEY,tenant_id text NOT NULL REFERENCES tenants(id),event_type text NOT NULL)`,
`CREATE FUNCTION pg_temp.reject_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit_immutable'; END; $$`,
`CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_audit_mutation()`,
`CREATE FUNCTION pg_temp.enforce_participant_party_match() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE buyer text; seller text; BEGIN SELECT buyer_party_id,seller_party_id INTO buyer,seller FROM commercial_transactions WHERE id=NEW.transaction_id; IF NEW.role='buyer' AND NEW.legal_party_id<>buyer THEN RAISE EXCEPTION 'buyer_party_mismatch'; END IF; IF NEW.role='seller' AND NEW.legal_party_id<>seller THEN RAISE EXCEPTION 'seller_party_mismatch'; END IF; RETURN NEW; END; $$`,
`CREATE TRIGGER participant_party_match BEFORE INSERT OR UPDATE ON transaction_participants FOR EACH ROW EXECUTE FUNCTION pg_temp.enforce_participant_party_match()`,
`CREATE TEMP TABLE offline_commands(id text PRIMARY KEY,membership_id text NOT NULL REFERENCES tenant_memberships(id),assignment_id text NOT NULL REFERENCES transaction_access_assignments(id),command text NOT NULL,status text NOT NULL)`
];
const sqliteDdl=[
`CREATE TABLE tenants(id text PRIMARY KEY)`,
`CREATE TABLE legal_parties(id text PRIMARY KEY)`,
`CREATE TABLE tenant_legal_party_bindings(id text PRIMARY KEY,tenant_id text NOT NULL REFERENCES tenants(id),legal_party_id text NOT NULL REFERENCES legal_parties(id),effective_from text NOT NULL,effective_to text,version integer NOT NULL,UNIQUE(id,tenant_id,legal_party_id),UNIQUE(tenant_id,version),CHECK(effective_to IS NULL OR effective_to>effective_from))`,
`CREATE TABLE commercial_transactions(id text PRIMARY KEY,buyer_party_id text NOT NULL,seller_party_id text NOT NULL,CHECK(buyer_party_id<>seller_party_id))`,
`CREATE TABLE transaction_participants(id text PRIMARY KEY,tenant_id text NOT NULL REFERENCES tenants(id),transaction_id text NOT NULL REFERENCES commercial_transactions(id),legal_party_id text NOT NULL,binding_id text NOT NULL,role text NOT NULL CHECK(role IN ('buyer','seller','supplier')),status text NOT NULL CHECK(status IN ('pending','active','suspended','revoked','expired')),UNIQUE(tenant_id,transaction_id),UNIQUE(id,tenant_id,transaction_id),FOREIGN KEY(binding_id,tenant_id,legal_party_id) REFERENCES tenant_legal_party_bindings(id,tenant_id,legal_party_id))`,
`CREATE UNIQUE INDEX uq_buyer_seller_role ON transaction_participants(transaction_id,role) WHERE role IN ('buyer','seller')`,
`CREATE TABLE tenant_memberships(id text PRIMARY KEY,tenant_id text NOT NULL REFERENCES tenants(id),user_id text NOT NULL,status text NOT NULL,UNIQUE(id,tenant_id))`,
`CREATE TABLE supply_sites(id text NOT NULL,tenant_id text NOT NULL REFERENCES tenants(id),PRIMARY KEY(id,tenant_id))`,
`CREATE TABLE transaction_site_links(id text PRIMARY KEY,tenant_id text NOT NULL,transaction_id text NOT NULL,participant_id text NOT NULL,site_id text NOT NULL,status text NOT NULL,UNIQUE(id,tenant_id,transaction_id,participant_id,site_id),FOREIGN KEY(participant_id,tenant_id,transaction_id) REFERENCES transaction_participants(id,tenant_id,transaction_id),FOREIGN KEY(site_id,tenant_id) REFERENCES supply_sites(id,tenant_id))`,
`CREATE TABLE transaction_access_assignments(id text PRIMARY KEY,tenant_id text NOT NULL,transaction_id text NOT NULL,participant_id text NOT NULL,site_id text NOT NULL,site_link_id text NOT NULL,membership_id text NOT NULL,FOREIGN KEY(participant_id,tenant_id,transaction_id) REFERENCES transaction_participants(id,tenant_id,transaction_id),FOREIGN KEY(site_id,tenant_id) REFERENCES supply_sites(id,tenant_id),FOREIGN KEY(site_link_id,tenant_id,transaction_id,participant_id,site_id) REFERENCES transaction_site_links(id,tenant_id,transaction_id,participant_id,site_id),FOREIGN KEY(membership_id,tenant_id) REFERENCES tenant_memberships(id,tenant_id))`,
`CREATE TABLE audit_events(id text PRIMARY KEY,tenant_id text NOT NULL REFERENCES tenants(id),event_type text NOT NULL)`,
`CREATE TRIGGER audit_immutable_update BEFORE UPDATE ON audit_events BEGIN SELECT RAISE(ABORT,'audit_immutable'); END`,
`CREATE TRIGGER audit_immutable_delete BEFORE DELETE ON audit_events BEGIN SELECT RAISE(ABORT,'audit_immutable'); END`,
`CREATE TRIGGER participant_party_match_insert BEFORE INSERT ON transaction_participants WHEN (NEW.role='buyer' AND NEW.legal_party_id<>(SELECT buyer_party_id FROM commercial_transactions WHERE id=NEW.transaction_id)) OR (NEW.role='seller' AND NEW.legal_party_id<>(SELECT seller_party_id FROM commercial_transactions WHERE id=NEW.transaction_id)) BEGIN SELECT RAISE(ABORT,'participant_party_mismatch'); END`,
`CREATE TRIGGER participant_party_match_update BEFORE UPDATE ON transaction_participants WHEN (NEW.role='buyer' AND NEW.legal_party_id<>(SELECT buyer_party_id FROM commercial_transactions WHERE id=NEW.transaction_id)) OR (NEW.role='seller' AND NEW.legal_party_id<>(SELECT seller_party_id FROM commercial_transactions WHERE id=NEW.transaction_id)) BEGIN SELECT RAISE(ABORT,'participant_party_mismatch'); END`,
`CREATE TABLE offline_commands(id text PRIMARY KEY,membership_id text NOT NULL REFERENCES tenant_memberships(id),assignment_id text NOT NULL REFERENCES transaction_access_assignments(id),command text NOT NULL,status text NOT NULL)`
];
for(const q of pgDdl) await pgClient.query(q);
for(const q of sqliteDdl) sqlite.exec(q);
const pgExec=(q,p=[])=>pgClient.query(q,p);
const sqExec=(q,p=[])=>sqlite.prepare(q).run(...p);
async function reset(){
  await pgExec('DROP TRIGGER IF EXISTS audit_immutable ON audit_events'); await pgExec('DELETE FROM offline_commands'); await pgExec('DELETE FROM audit_events'); await pgExec('CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_audit_mutation()'); await pgExec('DELETE FROM transaction_access_assignments'); await pgExec('DELETE FROM transaction_site_links'); await pgExec('DELETE FROM tenant_memberships'); await pgExec('DELETE FROM supply_sites'); await pgExec('DELETE FROM transaction_participants'); await pgExec('DELETE FROM commercial_transactions'); await pgExec('DELETE FROM tenant_legal_party_bindings'); await pgExec('DELETE FROM legal_parties'); await pgExec('DELETE FROM tenants');
  sqlite.exec('DROP TRIGGER IF EXISTS audit_immutable_update'); sqlite.exec('DROP TRIGGER IF EXISTS audit_immutable_delete');
  for(const t of ['offline_commands','audit_events','transaction_access_assignments','transaction_site_links','tenant_memberships','supply_sites','transaction_participants','commercial_transactions','tenant_legal_party_bindings','legal_parties','tenants']) sqlite.exec('DELETE FROM '+t);
  sqlite.exec("CREATE TRIGGER audit_immutable_update BEFORE UPDATE ON audit_events BEGIN SELECT RAISE(ABORT,'audit_immutable'); END"); sqlite.exec("CREATE TRIGGER audit_immutable_delete BEFORE DELETE ON audit_events BEGIN SELECT RAISE(ABORT,'audit_immutable'); END");
  for(const [id] of [['tenant-a'],['tenant-b'],['tenant-s1'],['tenant-s2']]) {await pgExec('INSERT INTO tenants VALUES($1)',[id]);sqExec('INSERT INTO tenants VALUES(?)',[id]);}
  for(const id of ['party-a','party-b','party-s1','party-s2']) {await pgExec('INSERT INTO legal_parties VALUES($1)',[id]);sqExec('INSERT INTO legal_parties VALUES(?)',[id]);}
  const binds=[['bind-a','tenant-a','party-a'],['bind-b','tenant-b','party-b'],['bind-s1','tenant-s1','party-s1'],['bind-s2','tenant-s2','party-s2']];
  for(const [id,t,p] of binds){await pgExec('INSERT INTO tenant_legal_party_bindings VALUES($1,$2,$3,$4,NULL,1) ',[id,t,p,'2026-01-01']);sqExec('INSERT INTO tenant_legal_party_bindings VALUES(?,?,?,?,NULL,1)',[id,t,p,'2026-01-01']);}
  await pgExec('INSERT INTO commercial_transactions VALUES($1,$2,$3)',['tx-1','party-a','party-b']);sqExec('INSERT INTO commercial_transactions VALUES(?,?,?)',['tx-1','party-a','party-b']);
  const parts=[['part-a','tenant-a','party-a','bind-a','buyer'],['part-b','tenant-b','party-b','bind-b','seller'],['part-s1','tenant-s1','party-s1','bind-s1','supplier'],['part-s2','tenant-s2','party-s2','bind-s2','supplier']];
  for(const [id,t,p,b,r] of parts){await pgExec('INSERT INTO transaction_participants VALUES($1,$2,$3,$4,$5,$6,$7)',[id,t,'tx-1',p,b,r,'active']);sqExec('INSERT INTO transaction_participants VALUES(?,?,?,?,?,?,?)',[id,t,'tx-1',p,b,r,'active']);}
  for(const [id,t,u] of [['mem-a','tenant-a','user-a'],['mem-b','tenant-b','user-b']]){await pgExec('INSERT INTO tenant_memberships VALUES($1,$2,$3,$4)',[id,t,u,'active']);sqExec('INSERT INTO tenant_memberships VALUES(?,?,?,?)',[id,t,u,'active']);}
  for(const [id,t] of [['site-a','tenant-a'],['site-s1','tenant-s1']]){await pgExec('INSERT INTO supply_sites VALUES($1,$2)',[id,t]);sqExec('INSERT INTO supply_sites VALUES(?,?)',[id,t]);}
  const links=[['link-a','tenant-a','part-a','site-a'],['link-s1','tenant-s1','part-s1','site-s1']];
  for(const [id,t,p,s] of links){await pgExec('INSERT INTO transaction_site_links VALUES($1,$2,$3,$4,$5,$6)',[id,t,'tx-1',p,s,'active']);sqExec('INSERT INTO transaction_site_links VALUES(?,?,?,?,?,?)',[id,t,'tx-1',p,s,'active']);}
  await pgExec('INSERT INTO transaction_access_assignments VALUES($1,$2,$3,$4,$5,$6,$7)',['assign-a','tenant-a','tx-1','part-a','site-a','link-a','mem-a']);sqExec('INSERT INTO transaction_access_assignments VALUES(?,?,?,?,?,?,?)',['assign-a','tenant-a','tx-1','part-a','site-a','link-a','mem-a']);
  await pgExec('INSERT INTO audit_events VALUES($1,$2,$3)',['audit-a','tenant-a','created']);sqExec('INSERT INTO audit_events VALUES(?,?,?)',['audit-a','tenant-a','created']);
  await pgExec('INSERT INTO offline_commands VALUES($1,$2,$3,$4,$5)',['offline-a','mem-a','assign-a','lot.receive','pending']);sqExec('INSERT INTO offline_commands VALUES(?,?,?,?,?)',['offline-a','mem-a','assign-a','lot.receive','pending']);
}
await reset();
const outcomes=[];
async function compare(id,expectReject,pgFn,sqliteFn){
  let p='accepted',s='accepted';
  try{await pgFn();}catch{p='rejected';}
  try{sqliteFn();}catch{s='rejected';}
  const ok=p===s && (expectReject?p==='rejected':p==='accepted');
  outcomes.push({id,postgres:p,sqlite:s,status:ok?'PASS':'FAIL'});
}
async function compareBoolean(id,pgFn,sqliteFn,expected=false){
  let p,s;
  try{p=Boolean(await pgFn());}catch{p='error';}
  try{s=Boolean(sqliteFn());}catch{s='error';}
  const ok=p===s && p===expected;
  outcomes.push({id,postgres:p,sqlite:s,status:ok?'PASS':'FAIL'});
}
await compare('PAR-001 duplicate tenant/transaction participant',true,()=>pgExec("INSERT INTO transaction_participants VALUES('dup','tenant-a','tx-1','party-a','bind-a','supplier','active')"),()=>sqExec("INSERT INTO transaction_participants VALUES(?,?,?,?,?,?,?)",['dup','tenant-a','tx-1','party-a','bind-a','supplier','active']));
await reset();
await compare('PAR-002 binding tenant/legal-party composite FK',true,()=>pgExec("INSERT INTO transaction_participants VALUES('bad-bind','tenant-a','tx-1','party-b','bind-b','supplier','active')"),()=>sqExec("INSERT INTO transaction_participants VALUES(?,?,?,?,?,?,?)",['bad-bind','tenant-a','tx-1','party-b','bind-b','supplier','active']));
await reset();
await compare('PAR-003 cross-tenant membership assignment',true,()=>pgExec("INSERT INTO transaction_access_assignments VALUES('bad-member','tenant-a','tx-1','part-a','site-a','link-a','mem-b')"),()=>sqExec("INSERT INTO transaction_access_assignments VALUES(?,?,?,?,?,?,?)",['bad-member','tenant-a','tx-1','part-a','site-a','link-a','mem-b']));
await reset();
await compare('PAR-004 mismatched exact site-link tuple',true,()=>pgExec("INSERT INTO transaction_access_assignments VALUES('bad-link','tenant-a','tx-1','part-a','site-a','link-s1','mem-a')"),()=>sqExec("INSERT INTO transaction_access_assignments VALUES(?,?,?,?,?,?,?)",['bad-link','tenant-a','tx-1','part-a','site-a','link-s1','mem-a']));
await reset();
await compare('PAR-005 duplicate Buyer role across independent tenant',true,async()=>{await pgExec("INSERT INTO tenants VALUES('tenant-extra')");await pgExec("INSERT INTO legal_parties VALUES('party-extra')");await pgExec("INSERT INTO tenant_legal_party_bindings VALUES('bind-extra','tenant-extra','party-extra','2026-01-01',NULL,1)");await pgExec("INSERT INTO transaction_participants VALUES('dup-buyer','tenant-extra','tx-1','party-extra','bind-extra','buyer','active')");},()=>{sqExec("INSERT INTO tenants VALUES('tenant-extra')");sqExec("INSERT INTO legal_parties VALUES('party-extra')");sqExec("INSERT INTO tenant_legal_party_bindings VALUES('bind-extra','tenant-extra','party-extra','2026-01-01',NULL,1)");sqExec("INSERT INTO transaction_participants VALUES(?,?,?,?,?,?,?)",['dup-buyer','tenant-extra','tx-1','party-extra','bind-extra','buyer','active']);});
await reset();
await compare('PAR-006 invalid effective interval',true,()=>pgExec("INSERT INTO tenant_legal_party_bindings VALUES('bad-interval','tenant-s1','party-s1','2026-02-01','2026-01-01',2)"),()=>sqExec("INSERT INTO tenant_legal_party_bindings VALUES(?,?,?,?,?,?)",['bad-interval','tenant-s1','party-s1','2026-02-01','2026-01-01',2]));
await reset();
await compare('PAR-007 Buyer/Seller legal party must differ',true,()=>pgExec("INSERT INTO commercial_transactions VALUES('tx-bad','party-a','party-a')"),()=>sqExec("INSERT INTO commercial_transactions VALUES(?,?,?)",['tx-bad','party-a','party-a']));
await reset();
await compare('PAR-008 multiple independent Supplier tenants allowed',false,async()=>{const r=await pgExec("SELECT count(*) FROM transaction_participants WHERE role='supplier'");assert.equal(Number(r.rows[0].count),2);},()=>{const r=sqlite.prepare("SELECT count(*) AS count FROM transaction_participants WHERE role='supplier'").get();assert.equal(Number(r.count),2);});
await reset();
await compare('PAR-009 audit history immutable',true,()=>pgExec("UPDATE audit_events SET event_type='tampered' WHERE id='audit-a'"),()=>sqExec("UPDATE audit_events SET event_type='tampered' WHERE id='audit-a'"));
await reset();
await compare('PAR-016 failed multi-step transaction rolls back',false,async()=>{await pgExec('BEGIN');try{await pgExec("INSERT INTO commercial_transactions VALUES('tx-rollback','party-a','party-b')");await pgExec("INSERT INTO transaction_participants VALUES('bad','tenant-a','missing-tx','party-a','bind-a','supplier','active')");}catch{}finally{await pgExec('ROLLBACK');}const r=await pgExec("SELECT id FROM commercial_transactions WHERE id='tx-rollback'");assert.equal(r.rowCount,0);},()=>{const tx=sqlite.transaction(()=>{sqExec("INSERT INTO commercial_transactions VALUES('tx-rollback','party-a','party-b')");sqExec("INSERT INTO transaction_participants VALUES('bad','tenant-a','missing-tx','party-a','bind-a','supplier','active')");});try{tx();}catch{}assert.equal(sqlite.prepare("SELECT id FROM commercial_transactions WHERE id='tx-rollback'").all().length,0);});

await reset();
await compare('PAR-011 Buyer/Seller participant legal-party must match transaction party',true,
  ()=>pgExec("INSERT INTO transaction_participants VALUES('bad-party','tenant-a','tx-1','party-b','bind-a','buyer','active')"),
  ()=>sqExec("INSERT INTO transaction_participants VALUES(?,?,?,?,?,?,?)",['bad-party','tenant-a','tx-1','party-b','bind-a','buyer','active']));
await reset();
await compare('PAR-012 same tenant cannot hold Buyer and Seller participant rows for one transaction',true,async()=>{
  await pgExec("INSERT INTO commercial_transactions VALUES('tx-same-tenant','party-a','party-b')");
  await pgExec("INSERT INTO transaction_participants VALUES('same-buyer','tenant-a','tx-same-tenant','party-a','bind-a','buyer','active')");
  await pgExec("INSERT INTO transaction_participants VALUES('same-seller','tenant-a','tx-same-tenant','party-b','bind-a','seller','active')");
},()=>{
  sqExec("INSERT INTO commercial_transactions VALUES(?,?,?)",['tx-same-tenant','party-a','party-b']);
  sqExec("INSERT INTO transaction_participants VALUES(?,?,?,?,?,?,?)",['same-buyer','tenant-a','tx-same-tenant','party-a','bind-a','buyer','active']);
  sqExec("INSERT INTO transaction_participants VALUES(?,?,?,?,?,?,?)",['same-seller','tenant-a','tx-same-tenant','party-b','bind-a','seller','active']);
});
await reset();
await compareBoolean('PAR-013 revoked membership denies assignment authorization',async()=>{
  await pgExec("UPDATE tenant_memberships SET status='revoked' WHERE id='mem-a'");
  const r=await pgExec("SELECT EXISTS(SELECT 1 FROM transaction_access_assignments a JOIN tenant_memberships m ON m.id=a.membership_id AND m.tenant_id=a.tenant_id JOIN transaction_participants p ON p.id=a.participant_id AND p.tenant_id=a.tenant_id AND p.transaction_id=a.transaction_id JOIN transaction_site_links l ON l.id=a.site_link_id AND l.tenant_id=a.tenant_id AND l.transaction_id=a.transaction_id AND l.participant_id=a.participant_id AND l.site_id=a.site_id WHERE a.id='assign-a' AND m.status='active' AND p.status='active' AND l.status='active') AS allowed");
  return r.rows[0].allowed;
},()=>{
  sqExec("UPDATE tenant_memberships SET status='revoked' WHERE id='mem-a'");
  return sqlite.prepare("SELECT EXISTS(SELECT 1 FROM transaction_access_assignments a JOIN tenant_memberships m ON m.id=a.membership_id AND m.tenant_id=a.tenant_id JOIN transaction_participants p ON p.id=a.participant_id AND p.tenant_id=a.tenant_id AND p.transaction_id=a.transaction_id JOIN transaction_site_links l ON l.id=a.site_link_id AND l.tenant_id=a.tenant_id AND l.transaction_id=a.transaction_id AND l.participant_id=a.participant_id AND l.site_id=a.site_id WHERE a.id='assign-a' AND m.status='active' AND p.status='active' AND l.status='active') AS allowed").get().allowed;
});
await reset();
await compareBoolean('PAR-014 revoked site link denies assignment authorization',async()=>{
  await pgExec("UPDATE transaction_site_links SET status='revoked' WHERE id='link-a'");
  const r=await pgExec("SELECT EXISTS(SELECT 1 FROM transaction_access_assignments a JOIN tenant_memberships m ON m.id=a.membership_id AND m.tenant_id=a.tenant_id JOIN transaction_participants p ON p.id=a.participant_id AND p.tenant_id=a.tenant_id AND p.transaction_id=a.transaction_id JOIN transaction_site_links l ON l.id=a.site_link_id AND l.tenant_id=a.tenant_id AND l.transaction_id=a.transaction_id AND l.participant_id=a.participant_id AND l.site_id=a.site_id WHERE a.id='assign-a' AND m.status='active' AND p.status='active' AND l.status='active') AS allowed");
  return r.rows[0].allowed;
},()=>{
  sqExec("UPDATE transaction_site_links SET status='revoked' WHERE id='link-a'");
  return sqlite.prepare("SELECT EXISTS(SELECT 1 FROM transaction_access_assignments a JOIN tenant_memberships m ON m.id=a.membership_id AND m.tenant_id=a.tenant_id JOIN transaction_participants p ON p.id=a.participant_id AND p.tenant_id=a.tenant_id AND p.transaction_id=a.transaction_id JOIN transaction_site_links l ON l.id=a.site_link_id AND l.tenant_id=a.tenant_id AND l.transaction_id=a.transaction_id AND l.participant_id=a.participant_id AND l.site_id=a.site_id WHERE a.id='assign-a' AND m.status='active' AND p.status='active' AND l.status='active') AS allowed").get().allowed;
});
await reset();
await compareBoolean('PAR-015 revoked offline command cannot be replayed',async()=>{
  await pgExec("UPDATE tenant_memberships SET status='revoked' WHERE id='mem-a'");
  const r=await pgExec("SELECT EXISTS(SELECT 1 FROM offline_commands c JOIN tenant_memberships m ON m.id=c.membership_id AND m.status='active' JOIN transaction_access_assignments a ON a.id=c.assignment_id WHERE c.id='offline-a' AND c.status='pending') AS replay_allowed");
  return r.rows[0].replay_allowed;
},()=>{
  sqExec("UPDATE tenant_memberships SET status='revoked' WHERE id='mem-a'");
  return sqlite.prepare("SELECT EXISTS(SELECT 1 FROM offline_commands c JOIN tenant_memberships m ON m.id=c.membership_id AND m.status='active' JOIN transaction_access_assignments a ON a.id=c.assignment_id WHERE c.id='offline-a' AND c.status='pending') AS replay_allowed").get().replay_allowed;
});

const versions={postgres:(await pgClient.query('SHOW server_version')).rows[0].server_version,sqlite:sqlite.prepare('SELECT sqlite_version() AS version').get().version};
await pgClient.end(); sqlite.close();
const schemaFingerprint=createHash('sha256').update([...pgDdl,...sqliteDdl].join('\\n')).digest('hex');
console.log(JSON.stringify({suite:'DEC-008 PostgreSQL/SQLite disposable parity subset',versions,schemaFingerprint,results:outcomes,passed:outcomes.filter(x=>x.status==='PASS').length,failed:outcomes.filter(x=>x.status==='FAIL').length,scope_note:'This suite covers PAR-001 through PAR-009 and PAR-011 through PAR-016 are relational/authorization fixtures. PAR-010 concurrency and PAR-017 through PAR-019 temporal edge cases run in temporal-concurrency-test.mjs. Synthetic schema only; canonical production schema and full AUTH-001–015 remain open.'},null,2));
if(outcomes.some(x=>x.status!=='PASS')) process.exitCode=1;
