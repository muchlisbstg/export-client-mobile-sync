# P0 Remaining Verification Plan

**Repository:** `muchlisbstg/export-client-mobile-sync`  
**Baseline:** `b4caeb1893625fce08341a82f2bb0f72dbff7e2b` (main, checked 2026-11-08)  
**Status:** Planning/evidence reconciliation only. No runtime code, DDL, migration, database connection, deployment, or production/staging operation is authorized by this document.

## 1. Current verified baseline

- PR #128 and PR #129 are integrated into main.
- PR #118 and PR #119 are closed, not merged. Their closure does not close P0.
- Issue #124 (schema/domain design) and issue #125 (independent security review) remain open.
- ADR P0-001 is marked NOT APPROVED.
- Existing test files cover authentication on protected route cases, selected role denials, selected positive transaction reads, selected site/transfer paths, and selected audit-write failure rollback cases.
- The existing role fixture includes enterprise_admin, buyer, seller, supplier, warehouse, qc, logistics, and auditor. That is not equivalent to complete role × endpoint × resource × site coverage.
- The schema contract test is SQLite-only and intentionally reports five missing schema constraints. No PostgreSQL integration/RLS test was found in the inspected source tree.
- Existing workflows include Android Preview APK, iOS Simulator Build, Expo Web Build, P0 browser security E2E, P0 complete authorization matrix, and P0 schema reconciliation. Workflow definitions existing in the repository are not proof that those workflows ran successfully on this baseline.
- The last known CI evidence on this baseline was reported separately; this document does not promote older run results to current-SHA evidence.

## 2. Domain and schema approval gate — BLOCKED

The recommended logical separation is:

- `legal_parties`: contractual buyer/seller legal identity.
- `operating_tenant_id`: enterprise operating the transaction.
- `transaction_tenant_scopes(tenant_id, transaction_id, scope_kind)`: explicit authorization scope.
- `supply_sites(tenant_id, id)`: tenant-owned operational sites.

The four intended composite foreign keys are:

1. `transaction_access_assignments(tenant_id, transaction_id)` → `transaction_tenant_scopes(tenant_id, transaction_id)`.
2. `transaction_site_links(tenant_id, transaction_id)` → `transaction_tenant_scopes(tenant_id, transaction_id)`.
3. `transaction_access_assignments(tenant_id, site_id)` → `supply_sites(tenant_id, id)`.
4. `transaction_site_links(tenant_id, site_id)` → `supply_sites(tenant_id, id)`.

Do not implement DDL until all of the following have written decisions:

- Buyer/Seller application roles are internal staff roles or external counterparty logins.
- Whether delegated tenant scopes are allowed; if yes, who grants them, their lifecycle, and their legal basis.
- Whether enterprise-wide NULL site scope is permitted, and the exact roles allowed to use it.
- Transaction scope creation, suspension, revocation, and post-contract amendment semantics.
- Legal-party identifiers, country/jurisdiction validation, retention, and signed-contract snapshot requirements.
- Independent Database Reviewer and independent Security Reviewer are identified and approve the exact candidate SHA.

**Known reconciliation item:** current runtime source still contains legacy buyer/seller tenant semantics, while ADR P0-001 recommends separating legal-party identity from tenant scope. The existing remediation document also contains older descriptive sections alongside the later alignment addendum. Before schema implementation, reconcile the source, migration definitions, ADR, and all documentation into one unambiguous model. Do not backfill tenant IDs into legal-party IDs by assumption.

## 3. Authorization matrix — required completion

### Role inventory

| Role | Required positive-path evidence | Required negative-path evidence |
|---|---|---|
| enterprise_admin | Read permitted enterprise resources; manage assignments, sites, links, revocations | Cannot access another enterprise or bypass audit persistence |
| buyer | Read only buyer-authorized transaction and permitted evidence/stock/trace views | Cannot perform operational mutations or administer assignments |
| seller | Read only seller-authorized transaction and permitted evidence/trace views | Cannot perform unauthorized warehouse/QC/logistics actions |
| supplier | Intake only at active assigned supplier site; permitted evidence | Cannot read stock or use foreign, inactive, unassigned, or wrong-type sites |
| warehouse | Receive/process/move/hand over only with required site scope | Cannot perform QC-only actions or operate on either unauthorized transfer endpoint |
| qc | Inspect eligible lots at assigned QC site; permitted evidence/trace | Cannot perform warehouse-only processing or inspect across site boundaries |
| logistics | Move/dispatch/receive only with both required endpoint scopes | Cannot dispatch without source scope or receive without destination scope |
| auditor | Read-only authorized audit/trace/evidence views | Cannot mutate operational or administrative resources |

### Endpoint/resource families

For each protected route registration (not just each route family), create table-driven tests for:

1. Authentication: missing, malformed, invalid, expired, revoked identity.
2. Enterprise context: active membership, absent membership, suspended membership, wrong tenant header, unknown tenant.
3. Role policy: each of the eight roles on allowed and denied actions.
4. Transaction policy: buyer-side, seller-side, operating tenant, delegated tenant (only if approved), non-party/non-scoped tenant, unassigned user, revoked assignment.
5. Site policy: correct active assigned site, unassigned site, inactive site, foreign-tenant site, wrong site type, revoked site assignment.
6. Mutation invariants: denied request does not change business rows, audit rows, inventory, outbox, or idempotency state.
7. Revocation: revoke enterprise role, site assignment, and transaction assignment; immediately verify all relevant route families reject access.
8. Disclosure: cross-tenant and unauthorized IDs return the agreed non-disclosing status/body without metadata leakage.

Required route families: session/admin, transaction list/detail, site create/assignment, lot intake, QC inspection, processing, inventory movement, evidence, stock, lot trace, handover create/dispatch/receive, transaction assignment grant/revoke, and transaction-site link create. Public catalog/inquiry/tracking and peer-sync routes must retain separate explicit contracts.

### Coverage acceptance

- A generated route inventory is checked against actual Express route registration.
- Every protected method/path has at least one missing/invalid/expired authentication case.
- Every route/role pair has an explicit expected allow/deny result; no implicit untested cell.
- Every allowed operational role path has positive and negative site fixtures.
- Every mutation route has audit-failure injection and state-before/state-after assertions.
- Revocation tests cover every route family affected by the revoked capability.
- Test report publishes counts of required, implemented, and passing matrix cells on the exact commit SHA.

## 4. PostgreSQL integration and RLS — NOT IMPLEMENTED / REQUIRED

Do not treat SQLite as proof of PostgreSQL FK or RLS behavior. Build an isolated disposable PostgreSQL CI service/database with synthetic fixtures only.

Required test groups:

1. **Composite FK integrity**
   - valid tenant/transaction scope accepted;
   - non-scoped tenant/transaction pair rejected;
   - assignment with mismatched tenant/site rejected;
   - site link with mismatched tenant/site rejected;
   - duplicate scope rejected;
   - NULL site accepted/rejected exactly according to the approved role policy;
   - delete/update behavior matches the approved lifecycle and does not silently orphan assignments.

2. **RLS isolation**
   - test using the same least-privilege database role used by the application;
   - assert role is not superuser and does not have BYPASSRLS;
   - verify table owner behavior separately; do not use owner/superuser results as proof;
   - test both ENABLE ROW LEVEL SECURITY and FORCE ROW LEVEL SECURITY where required;
   - verify tenant A cannot SELECT/INSERT/UPDATE/DELETE tenant B rows;
   - verify a tenant with no transaction scope cannot read the transaction;
   - verify revoked scopes stop access;
   - verify legal-party visibility does not imply tenant access;
   - verify caller-controlled session variables/tenant headers cannot forge authorization context.

3. **Transaction/session hygiene**
   - set tenant/user context transaction-locally;
   - prove pooled connections do not leak prior request context;
   - prove rollback clears context and partial writes;
   - prove background jobs and service credentials use explicit narrow policies.

4. **Migration safety**
   - schema-only dry-run against a disposable database;
   - orphan/duplicate/mismatch reports from synthetic fixtures;
   - deterministic backfill rehearsal only after domain approval;
   - rollback and lock/availability analysis;
   - no staging or production database access in this workstream.

Acceptance requires PostgreSQL integration evidence, RLS positive and negative tests, schema diff, migration/rollback review, and independent Database/Security approval on one exact SHA.

## 5. Audit persistence failure matrix — partial coverage today

Existing failure injection covers selected transaction assignment grant/regrant/revoke, site-link creation, site-assignment grant/revoke, and lot intake paths. It is not exhaustive.

Add injected audit insert/update failure for every remaining mutation route, including site creation if audited, QC inspection, processing, inventory movement, evidence capture, handover creation/dispatch/receive, and any mutation of transaction state. For each:
- response must fail closed with the documented status;
- domain rows and related inventory/outbox/idempotency records must roll back;
- no success response may be returned;
- no partial audit event may remain;
- retry behavior must be deterministic and idempotent.

Only include routes that actually mutate data; record explicit N/A with source evidence for read-only routes.

## 6. Browser and platform verification

All platform checks must run against the same candidate commit SHA, with artifacts and workflow URLs retained.

| Platform | Required evidence | Current status on baseline |
|---|---|---|
| Android | Expo SDK compatibility, JS bundle, native prebuild, debug APK, artifact checksum, install/launch smoke test | Latest-main native APK not verified by the last known run |
| iOS Simulator | Expo compatibility, prebuild, CocoaPods, unsigned simulator build, install, launch, process/screenshot evidence | Latest-main simulator run not verified |
| Web | Expo Web export, browser runtime, login/session, CORS preflight + actual request, hostile-origin rejection | Latest-main Web export not verified |
| API interoperability | API client tests, typecheck, three-backend sync/interoperability tests | Prior main run reported successful; re-run on candidate SHA |

Do not describe Android JS bundle export as native APK verification. Do not describe iOS compilation as simulator install/launch verification. Do not describe server-side CORS tests as browser E2E.

For browser CORS E2E, retain evidence for configured origin preflight, non-safelisted headers, actual authenticated request, disallowed origin, unsupported method/header, and credential policy. CORS is not authorization.

## 7. Release and governance gates

P0 cannot close until:
- domain/legal model is approved;
- composite FK and PostgreSQL RLS implementation is reviewed;
- complete authorization matrix passes;
- audit failure matrix passes;
- independent Database and Security reviews are APPROVED against the exact SHA;
- Android native, iOS Simulator, and Web verification all pass on the same candidate SHA;
- no unresolved critical/high security issue remains without an accepted risk disposition.

Additional release gates remain separate: dependency/CVE review, secrets/environment review, backup/recovery, observability, incident response, concurrency/performance, origin/traceability documentation, legal/compliance review, and Syariah governance. No real-money or payment settlement capability is enabled before legal, akad, bank, and Syariah approval.

## 8. Execution order

1. Obtain written domain decisions and independent reviewer identities.
2. Reconcile ADR, source schema, migration definitions, and remediation documentation.
3. Implement schema candidate on a feature branch only after approval.
4. Add disposable PostgreSQL FK/RLS integration tests.
5. Complete route × role × resource × site positive/negative matrix and audit failure injection.
6. Run all Android/iOS/Web workflows on one candidate SHA.
7. Request independent reviews; remediate findings and repeat on the new exact SHA.
8. Keep PRs Draft until all evidence and approvals are present. No merge/deploy/database migration without separate explicit approval.

## 9. Evidence log

| Item | Evidence | Disposition |
|---|---|---|
| Main baseline | `b4caeb1893625fce08341a82f2bb0f72dbff7e2b` | Read-only checked |
| Schema ADR | `docs/adr/ADR-P0-001-transaction-party-composite-integrity.md` | NOT APPROVED |
| Schema review | Issue #124 | OPEN |
| Independent security review | Issue #125 | OPEN |
| PostgreSQL FK/RLS | No integration test found in inspected source tree | OPEN |
| Complete authorization Cartesian matrix | Existing partial tests; full coverage not proven | OPEN |
| Android native APK on latest SHA | No latest-SHA evidence confirmed | OPEN |
| iOS Simulator on latest SHA | No latest-SHA evidence confirmed | OPEN |
| Expo Web on latest SHA | No latest-SHA evidence confirmed | OPEN |
| PR #118 / #119 | Closed, not merged | Complete as administrative cleanup only |
