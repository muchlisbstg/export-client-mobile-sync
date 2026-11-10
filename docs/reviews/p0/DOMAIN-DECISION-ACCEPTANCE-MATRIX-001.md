# DOMAIN-DECISION-ACCEPTANCE-MATRIX-001

**Status:** ACCEPTANCE SPECIFICATION — NOT EXECUTED  
**Date:** 2026-11-10  
**Baseline:** DEC-001–DEC-005 approved; DEC-006–DEC-008 open  
**Mode:** Read-only review

## 1. Purpose

This matrix defines expected positive and negative behavior. It is not a test report; no test execution is claimed.

## 2. Four integrity-gap resolutions

| Gap | Canonical resolution | Design status |
|---|---|---|
| Binding version | Participant stores NOT NULL `tenant_legal_party_binding_id`; composite FK pins `(binding_id,tenant_id,legal_party_id)` | RESOLVED IN SPEC — REVIEW |
| Buyer/Seller role uniqueness | Separate partial unique indexes on transaction_id for buyer and seller roles | RESOLVED IN SPEC — REVIEW |
| Membership consistency | Assignment stores `membership_id,tenant_id`; composite FK to stable membership `(id,tenant_id)`; user derived from membership | RESOLVED IN SPEC — REVIEW |
| Assignment/site-link consistency | Assignment stores site_link_id and composite FK pins exact site-link/tenant/transaction/participant/site tuple | RESOLVED IN SPEC — REVIEW |

## 3. Key and constraint acceptance

| ID | Constraint | Positive case | Negative case |
|---|---|---|---|
| KEY-001 | Participant PK id | Unique ID inserts | Duplicate ID rejected |
| KEY-002 | UNIQUE(tenant_id,transaction_id) | One tenant participates | Duplicate pair rejected |
| KEY-003 | UNIQUE(id,tenant_id,transaction_id) | Child references exact participant | Mismatched tenant/transaction rejected |
| KEY-004 | UNIQUE(tenant_id,id) on supply_sites | Same-tenant site resolves | Cross-tenant site rejected |
| KEY-005 | Assignment participant composite FK | Exact participant tuple accepted | Forged participant/tenant/transaction tuple rejected |
| KEY-006 | Site-link participant composite FK | Exact participant tuple accepted | Mismatched participant tuple rejected |
| KEY-007 | Assignment site composite FK | Same-tenant site accepted | Other-tenant site rejected |
| KEY-008 | Site-link site composite FK | Same-tenant site accepted | Other-tenant site rejected |
| KEY-009 | Participant binding-version FK | Exact binding version accepted | Binding from other tenant/legal party rejected |
| KEY-010 | Buyer partial unique index | First Buyer participant accepted | Second Buyer participant for transaction rejected |
| KEY-011 | Seller partial unique index | First Seller participant accepted | Second Seller participant for transaction rejected |
| KEY-012 | Membership composite FK | Assignment references membership in same tenant | Cross-tenant membership rejected |
| KEY-013 | Exact site-link composite FK | Assignment references exact link tuple | Different site/participant/transaction link rejected |
| KEY-014 | Active membership runtime check | Active membership permits scoped operation | Revoked/expired membership denied |
| KEY-015 | Active site-link runtime check | Active linked site permits scoped operation | Revoked/expired link denied |
| KEY-016 | Binding temporal uniqueness | Adjacent half-open periods accepted | Overlap rejected |
| KEY-017 | Effective periods | Valid positive interval accepted | End <= start rejected |
| KEY-018 | Controlled vocabularies | Known active status/action accepted | Unknown/deprecated status/action rejected |
| KEY-019 | Buyer/Seller role-party match | Role party matches transaction party | Mismatched legal party rejected |
| KEY-020 | Buyer/Seller tenant distinctness | Distinct tenants activate | Same tenant on both sides rejected |

## 4. PostgreSQL / SQLite parity corpus

| ID | Scenario | PostgreSQL | SQLite |
|---|---|---|---|
| PAR-001 | Duplicate tenant/transaction participant | Reject | Reject |
| PAR-002 | Assignment cross-tenant participant tuple | Reject | Reject |
| PAR-003 | Site link cross-tenant site tuple | Reject | Reject |
| PAR-004 | Duplicate Buyer/Seller role | Reject | Reject |
| PAR-005 | Binding version tenant/legal-party mismatch | Reject | Reject |
| PAR-006 | Assignment cross-tenant membership | Reject | Reject |
| PAR-007 | Assignment references different/unlinked site link | Reject | Reject |
| PAR-008 | Invalid status/action vocabulary | Reject | Reject |
| PAR-009 | Invalid effective period | Reject | Reject |
| PAR-010 | Overlapping verified binding periods under concurrent write | Exactly one succeeds | Exactly one succeeds |
| PAR-011 | Buyer/Seller legal-party mismatch | Reject | Reject |
| PAR-012 | Same tenant as Buyer and Seller | Reject before activation | Reject before activation |
| PAR-013 | Revoked membership/site link | Server authorization denies | Server authorization denies |
| PAR-014 | Revoked offline event replay | Server rejects | Server rejects |
| PAR-015 | Audit history mutation by ordinary app role | Reject | Reject |

SQLite parity requires `PRAGMA foreign_keys=ON` on every connection, a pinned minimum SQLite version supporting partial indexes, equivalent triggers, and serialized write transactions for temporal checks.

## 5. Authorization negative-access acceptance

| ID | Scenario | Expected |
|---|---|---|
| AUTH-001 | Tenant has no participant for transaction | DENY |
| AUTH-002 | Supplier participant pending | DENY |
| AUTH-003 | Supplier active but no exact active site link/assignment | DENY |
| AUTH-004 | Assignment membership belongs to another tenant | FK rejection |
| AUTH-005 | Assignment membership revoked | DENY |
| AUTH-006 | Assignment site link revoked/expired | DENY |
| AUTH-007 | Assignment action absent/deprecated | DENY |
| AUTH-008 | Participant suspended/revoked/expired | DENY |
| AUTH-009 | Client forges tenant/membership/participant/site/action | DENY |
| AUTH-010 | Supplier reads unrelated tenant resource | DENY without data leak |
| AUTH-011 | Supplier attempts contract approval | DENY |
| AUTH-012 | Supplier attempts payment approval/ledger mutation | DENY |
| AUTH-013 | Supplier attempts goods release | DENY |
| AUTH-014 | Stale offline command after server revocation | Server rejects replay |
| AUTH-015 | All exact predicates active | ALLOW within exact scope only |

## 6. DEC-006–008 review gates

| DEC | Closure evidence required | Current status |
|---|---|---|
| DEC-006 RLS | Tenant/participant/action policy matrix; app role is not owner/superuser/BYPASSRLS; FORCE ROW LEVEL SECURITY where applicable; transaction-local tenant context; read/write policy tests; cross-tenant negative tests; pool-context reset tests | OPEN |
| DEC-007 SQLite provenance | Actual runtime library/version; database path; schema version/hash; `PRAGMA foreign_keys` per connection; inventory of tables/indexes/FKs/checks/triggers; migration source and startup path; tests covering reopen/worker connections | NOT VERIFIED |
| DEC-008 PG–SQLite parity | Disposable DBs on pinned engine versions; same fixtures and positive/negative corpus; compare constraint outcomes, NULL semantics, time precision, partial indexes, triggers, rollback and concurrency; source SHA + schema version evidence | NOT VERIFIED |

### DEC-006 detailed review checklist

- [ ] Define tenant context source from authenticated server-side membership; reject client tenant override.
- [ ] Define RLS policies for every tenant-owned table and relationship table.
- [ ] Define participant/site/action-scoped predicates; avoid broad transaction access by NULL.
- [ ] Use non-owner application role without BYPASSRLS; evaluate FORCE ROW LEVEL SECURITY.
- [ ] Ensure connection-pool tenant context is transaction-local and cleared on commit/rollback.
- [ ] Test cross-tenant SELECT/INSERT/UPDATE/DELETE, including indirect joins and nested relations.
- [ ] Test owner, migration, worker, background-job and service roles separately.
- [ ] Ensure backend authorization remains active; RLS is defense-in-depth.

### DEC-007 detailed review checklist

- [ ] Identify SQLite library actually loaded by each app/runtime, not just CLI version.
- [ ] Capture database file path and schema version/hash.
- [ ] Verify `PRAGMA foreign_keys` returns 1 on every connection.
- [ ] Inventory `foreign_key_list`, `index_list`, table SQL, CHECKs and triggers.
- [ ] Verify partial unique indexes exist and reject duplicate Buyer/Seller roles.
- [ ] Verify app startup, background workers and reopen paths all enable FKs.
- [ ] Record evidence against exact commit and runtime build.

### DEC-008 detailed review checklist

- [ ] Pin PostgreSQL and SQLite versions.
- [ ] Run same fixture corpus against disposable databases only.
- [ ] Compare positive/negative outcomes and SQL error classes.
- [ ] Include concurrent overlapping binding writes and transaction rollback.
- [ ] Include partial unique index, composite FK and trigger parity.
- [ ] Include NULL, timestamp precision and half-open boundary cases.
- [ ] Publish schema hashes, test logs and exact source commit references.

## 7. Evidence and implementation readiness

| Gate | Current status |
|---|---|
| Domain DEC-001–005 | APPROVED |
| Four integrity gap resolutions | RESOLVED IN SPEC — REVIEW PENDING |
| Logical entity/key mapping | COMPLETE FOR REVIEW |
| DEC-006 RLS | OPEN |
| DEC-007 SQLite provenance | NOT VERIFIED |
| DEC-008 parity | NOT VERIFIED |
| Backend authorization and legacy reconciliation | NOT VERIFIED / OPEN |
| Schema freeze | NOT READY |
| Implementation readiness | NOT READY |

## 8. Review sign-off checklist

- [ ] Accept binding-version FK and immutable historical reference.
- [ ] Accept partial unique indexes for Buyer and Seller.
- [ ] Accept membership_id assignment reference and stable membership identity.
- [ ] Accept exact site-link composite FK.
- [ ] Accept cross-row trigger/normalized-relation enforcement for role-party matching.
- [ ] Confirm engine versions and timestamp/UUID representation.
- [ ] Close DEC-006, DEC-007 and DEC-008 with source-pinned evidence.
- [ ] Only then assess schema-freeze readiness.

## 9. Governance

This is a test specification, not a test report. No tests were run by creating this document. No DDL, migration, source implementation, shared/live test, PR, merge or deployment is authorized.
