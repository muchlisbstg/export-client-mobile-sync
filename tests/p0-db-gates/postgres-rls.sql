-- Disposable test schema only. Never apply to staging/production.
CREATE ROLE app_api WITH LOGIN PASSWORD 'app_api_test_only' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
CREATE TABLE tenants(id text PRIMARY KEY);
CREATE TABLE tenant_memberships(id text PRIMARY KEY, tenant_id text NOT NULL REFERENCES tenants(id), user_id text NOT NULL, status text NOT NULL CHECK(status IN ('active','revoked','expired')), UNIQUE(id,tenant_id));
CREATE TABLE commercial_transactions(id text PRIMARY KEY, buyer_party_id text NOT NULL, seller_party_id text NOT NULL, CHECK(buyer_party_id <> seller_party_id));
CREATE TABLE transaction_participants(id text PRIMARY KEY, tenant_id text NOT NULL REFERENCES tenants(id), transaction_id text NOT NULL REFERENCES commercial_transactions(id), role text NOT NULL CHECK(role IN ('buyer','seller','supplier')), status text NOT NULL CHECK(status IN ('pending','active','suspended','revoked','expired')), UNIQUE(tenant_id,transaction_id), UNIQUE(id,tenant_id,transaction_id));
CREATE TABLE supply_sites(id text NOT NULL, tenant_id text NOT NULL REFERENCES tenants(id), PRIMARY KEY(id,tenant_id));
CREATE TABLE transaction_site_links(id text PRIMARY KEY, tenant_id text NOT NULL, transaction_id text NOT NULL, participant_id text NOT NULL, site_id text NOT NULL, status text NOT NULL CHECK(status IN ('active','revoked')), UNIQUE(id,tenant_id,transaction_id,participant_id,site_id), FOREIGN KEY(participant_id,tenant_id,transaction_id) REFERENCES transaction_participants(id,tenant_id,transaction_id), FOREIGN KEY(site_id,tenant_id) REFERENCES supply_sites(id,tenant_id));
CREATE TABLE transaction_access_assignments(id text PRIMARY KEY, tenant_id text NOT NULL, transaction_id text NOT NULL, participant_id text NOT NULL, site_id text NOT NULL, site_link_id text NOT NULL, membership_id text NOT NULL, status text NOT NULL CHECK(status IN ('active','revoked')), FOREIGN KEY(participant_id,tenant_id,transaction_id) REFERENCES transaction_participants(id,tenant_id,transaction_id), FOREIGN KEY(site_id,tenant_id) REFERENCES supply_sites(id,tenant_id), FOREIGN KEY(site_link_id,tenant_id,transaction_id,participant_id,site_id) REFERENCES transaction_site_links(id,tenant_id,transaction_id,participant_id,site_id), FOREIGN KEY(membership_id,tenant_id) REFERENCES tenant_memberships(id,tenant_id));
CREATE TABLE permission_actions(code text PRIMARY KEY, active boolean NOT NULL DEFAULT true);
CREATE TABLE transaction_access_assignment_actions(assignment_id text NOT NULL REFERENCES transaction_access_assignments(id), action_code text NOT NULL REFERENCES permission_actions(code), PRIMARY KEY(assignment_id,action_code));
CREATE TABLE audit_events(id text PRIMARY KEY, tenant_id text NOT NULL REFERENCES tenants(id), transaction_id text NOT NULL, event_type text NOT NULL);

CREATE FUNCTION app_tenant() RETURNS text LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('app.tenant_id', true),'') $$;
CREATE FUNCTION app_user() RETURNS text LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('app.user_id', true),'') $$;

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY; ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY; ALTER TABLE tenant_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE commercial_transactions ENABLE ROW LEVEL SECURITY; ALTER TABLE commercial_transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE transaction_participants ENABLE ROW LEVEL SECURITY; ALTER TABLE transaction_participants FORCE ROW LEVEL SECURITY;
ALTER TABLE supply_sites ENABLE ROW LEVEL SECURITY; ALTER TABLE supply_sites FORCE ROW LEVEL SECURITY;
ALTER TABLE transaction_site_links ENABLE ROW LEVEL SECURITY; ALTER TABLE transaction_site_links FORCE ROW LEVEL SECURITY;
ALTER TABLE transaction_access_assignments ENABLE ROW LEVEL SECURITY; ALTER TABLE transaction_access_assignments FORCE ROW LEVEL SECURITY;
ALTER TABLE transaction_access_assignment_actions ENABLE ROW LEVEL SECURITY; ALTER TABLE transaction_access_assignment_actions FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY; ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;
ALTER TABLE permission_actions ENABLE ROW LEVEL SECURITY; ALTER TABLE permission_actions FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON tenants USING(id=app_tenant()) WITH CHECK(id=app_tenant());
CREATE POLICY membership_scope ON tenant_memberships USING(tenant_id=app_tenant() AND user_id=app_user() AND status='active') WITH CHECK(tenant_id=app_tenant() AND user_id=app_user());
CREATE POLICY transaction_scope ON commercial_transactions USING(EXISTS(SELECT 1 FROM transaction_participants p WHERE p.transaction_id=id AND p.tenant_id=app_tenant() AND p.status='active')) WITH CHECK(EXISTS(SELECT 1 FROM transaction_participants p WHERE p.transaction_id=id AND p.tenant_id=app_tenant() AND p.status='active'));
CREATE POLICY participant_scope ON transaction_participants USING(tenant_id=app_tenant() AND status='active') WITH CHECK(tenant_id=app_tenant());
CREATE POLICY site_scope ON supply_sites USING(tenant_id=app_tenant()) WITH CHECK(tenant_id=app_tenant());
CREATE POLICY site_link_scope ON transaction_site_links USING(tenant_id=app_tenant() AND status='active') WITH CHECK(tenant_id=app_tenant());
CREATE POLICY assignment_scope ON transaction_access_assignments USING(tenant_id=app_tenant() AND status='active' AND EXISTS(SELECT 1 FROM tenant_memberships m WHERE m.id=membership_id AND m.tenant_id=app_tenant() AND m.user_id=app_user() AND m.status='active') AND EXISTS(SELECT 1 FROM transaction_participants p WHERE p.id=participant_id AND p.tenant_id=app_tenant() AND p.transaction_id=transaction_id AND p.status='active') AND EXISTS(SELECT 1 FROM transaction_site_links l WHERE l.id=site_link_id AND l.tenant_id=app_tenant() AND l.transaction_id=transaction_id AND l.participant_id=participant_id AND l.site_id=site_id AND l.status='active')) WITH CHECK(tenant_id=app_tenant());
CREATE POLICY assignment_action_scope ON transaction_access_assignment_actions USING(EXISTS(SELECT 1 FROM transaction_access_assignments a WHERE a.id=assignment_id AND a.tenant_id=app_tenant() AND a.status='active')) WITH CHECK(EXISTS(SELECT 1 FROM transaction_access_assignments a WHERE a.id=assignment_id AND a.tenant_id=app_tenant() AND a.status='active'));
CREATE POLICY audit_scope ON audit_events USING(tenant_id=app_tenant()) WITH CHECK(tenant_id=app_tenant());
CREATE POLICY actions_read ON permission_actions FOR SELECT USING(true);

GRANT USAGE ON SCHEMA public TO app_api;
GRANT SELECT,INSERT,UPDATE,DELETE ON tenants,tenant_memberships,commercial_transactions,transaction_participants,supply_sites,transaction_site_links,transaction_access_assignments,transaction_access_assignment_actions,audit_events TO app_api;
GRANT SELECT ON permission_actions TO app_api;
GRANT EXECUTE ON FUNCTION app_tenant(),app_user() TO app_api;

INSERT INTO tenants VALUES ('tenant-a'),('tenant-b'),('tenant-s');
INSERT INTO tenant_memberships VALUES ('member-a','tenant-a','user-a','active'),('member-b','tenant-b','user-b','active'),('member-s','tenant-s','user-s','active'),('member-revoked','tenant-a','user-old','revoked');
INSERT INTO commercial_transactions VALUES ('tx-1','party-a','party-b');
INSERT INTO transaction_participants VALUES ('part-a','tenant-a','tx-1','buyer','active'),('part-b','tenant-b','tx-1','seller','active'),('part-s','tenant-s','tx-1','supplier','active'),('part-pending','tenant-a','tx-1','buyer','pending');
INSERT INTO supply_sites VALUES ('site-a','tenant-a'),('site-b','tenant-b'),('site-s','tenant-s');
INSERT INTO transaction_site_links VALUES ('link-a','tenant-a','tx-1','part-a','site-a','active'),('link-s','tenant-s','tx-1','part-s','site-s','active');
INSERT INTO transaction_access_assignments VALUES ('assign-a','tenant-a','tx-1','part-a','site-a','link-a','member-a','active'),('assign-s','tenant-s','tx-1','part-s','site-s','link-s','member-s','active');
INSERT INTO permission_actions VALUES ('site.inspect',true),('contract.approve',true),('payment.approve',true),('goods.release',true);
INSERT INTO transaction_access_assignment_actions VALUES ('assign-a','site.inspect'),('assign-s','site.inspect');
INSERT INTO audit_events VALUES ('audit-a','tenant-a','tx-1','created'),('audit-s','tenant-s','tx-1','created');
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
REVOKE UPDATE,DELETE ON audit_events FROM app_api;
