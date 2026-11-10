# DEC-007-008-EXECUTION-AND-SCHEMA-FREEZE-PACKAGE-001

**Status:** PRE-FREEZE REVIEW PACKAGE — BLOCKED BY RUNTIME AND EXECUTION EVIDENCE
**Date:** 2026-11-10
**Repository:** muchlisbstg/export-client-mobile-sync
**Branch:** review/p0-domain-schema-readonly-2026-11-10
**Base evidence commit:** d6f8d030ea35dd32c8c9631d78ebccea499aae18
**RLS design acceptance record:** DEC-006-RLS-POLICY-MATRIX-001
**Execution boundary:** No production/staging database access, no live mutation, no schema migration, no deployment, no automatic freeze.

## 1. Decision summary

This package consolidates the review gates required before a schema-freeze decision. It is not a freeze approval.

| Gate | Current decision | Closure evidence |
|---|---|---|
| DEC-006 RLS design | ACCEPTED AS LOGICAL POLICY DESIGN | Executable policy, role/privilege proof and negative-access results still required |
| DEC-007 SQLite provenance | BLOCKED — HOST RUNTIME EVIDENCE UNAVAILABLE | Process-to-file provenance, embedded SQLite version, all connection paths and physical schema inventory |
| DEC-008 parity | BLOCKED — HARNESS NOT EXECUTED | Same fixture corpus executed on disposable PostgreSQL and SQLite, with logs and outcome comparison |
| Schema/authorization/lifecycle reconciliation | PENDING | Evidence-based cross-review against DEC-001–005 and actual runtime |
| Cross-platform contract | PENDING | Web/Mobile/Desktop contract parity and authoritative backend enforcement evidence |
| Schema freeze | NOT READY | All critical gates closed and explicit human approval |

## 2. DEC-007 — runtime provenance procedure

### 2.1 Required host evidence

Run only on the host that actually runs the API process. Do not infer runtime identity from a developer workstation or repository defaults.

Capture:
- API PID and process identity, service/container identity, working directory and deployed build/commit.
- SQLite database path opened by that process, established through process file descriptors or an equivalent host-level runtime inspection.
- SQLite library version reported by the API's actual SQLite connection.
- Every database connection constructor and worker/reopen path.
- PRAGMA foreign_keys for every connection path.
- Schema-only inventory: tables, columns, primary keys, unique and partial indexes, foreign keys, checks, triggers and migration/schema version.
- integrity_check and foreign_key_check results.
- Schema fingerprint and exact source/build SHA.

Do not export database files, WAL/SHM files, secrets, credentials or operational rows. Record inaccessible host/process evidence as NOT AVAILABLE; do not substitute source-code defaults.

### 2.2 Host-side process discovery

The host operator should identify the API PID and working directory without dumping environment variables or secrets. Inspect open file descriptors for SQLite database paths. If the runtime is containerized, establish the container/process identity and map the open database path to the container volume. Record any inability to inspect descriptors or container mounts.

### 2.3 Connection-level verification

For each actual connection constructor/path, record:
- PRAGMA database_list
- PRAGMA foreign_keys
- SELECT sqlite_version()
- PRAGMA integrity_check
- PRAGMA foreign_key_check

Inventory schema through sqlite_schema/sqlite_master and the table-specific PRAGMA table_info, foreign_key_list and index_list. Capture trigger SQL. Verify the SQLite version supports every required feature, including partial indexes. The foreign_keys result must be 1 for every connection, not merely one manually opened connection.

### 2.4 DEC-007 acceptance

PASS only when the API process, actual file path, embedded engine version, all connection paths, schema fingerprint and physical constraints are evidenced and reconciled against CANONICAL-ENTITY-KEY-CONSTRAINT-MAPPING-001. A source PRAGMA statement alone is insufficient.

## 3. DEC-008 — parity harness contract

### 3.1 Disposable-only execution topology

The harness must create isolated disposable PostgreSQL and SQLite databases. It must not accept production/staging connection strings, shared persistent database URLs or credentials. PostgreSQL must run with a pinned image/version; SQLite must use a pinned embedded library version. Both adapters load the same deterministic synthetic fixture corpus.

Suggested harness layout:

tests/parity/
- versions.lock
- fixtures/baseline.json
- fixtures/tenant-domain.json
- adapters/postgres.mjs
- adapters/sqlite.mjs
- cases/keys.test.mjs
- cases/composite-fks.test.mjs
- cases/partial-unique.test.mjs
- cases/temporal-concurrency.test.mjs
- cases/lifecycle.test.mjs
- cases/rollback.test.mjs
- cases/authorization-negative.test.mjs
- expected/outcomes.json
- reports/

This is a target layout, not a statement that executable files or test runs currently exist.

### 3.2 Required fixture invariants

The same logical fixture IDs and values must be loaded into both engines. Include:
- Multiple independent Buyer, Seller and Supplier tenants.
- Versioned legal-party bindings with adjacent and overlapping effective intervals.
- One transaction with Buyer/Seller and multiple Supplier participants.
- Duplicate Buyer/Seller role attempts.
- Cross-tenant participant, membership and site-link assignments.
- Active, pending, suspended, revoked and expired lifecycle states.
- Active/deprecated/missing action grants.
- Exact and mismatched site-link tuples.
- Audit immutability attempts.
- UTC timestamps, NULL cases and UUID representations.

No real personal, customer, financial or production records are permitted.

### 3.3 Required parity scenarios

| ID | Scenario | Expected |
|---|---|---|
| PAR-001 | Duplicate candidate key | Both reject |
| PAR-002 | Cross-tenant participant composite FK | Both reject |
| PAR-003 | Cross-tenant site composite FK | Both reject |
| PAR-004 | Duplicate Buyer role | Both reject |
| PAR-005 | Duplicate Seller role | Both reject |
| PAR-006 | Binding version tenant/legal-party mismatch | Both reject |
| PAR-007 | Cross-tenant membership assignment | Both reject |
| PAR-008 | Assignment references mismatched site-link tuple | Both reject |
| PAR-009 | Invalid effective interval | Both reject |
| PAR-010 | Overlapping verified binding under concurrent writes | Exactly one succeeds |
| PAR-011 | Buyer/Seller legal-party mismatch | Both reject |
| PAR-012 | Same tenant used as Buyer and Seller before activation | Both reject |
| PAR-013 | Revoked membership/site-link operation | Server authorization denies |
| PAR-014 | Revoked offline command replay | Server rejects |
| PAR-015 | Ordinary application role mutates audit history | Both reject |
| PAR-016 | Failed multi-step write/rollback | No partial state remains |

RLS-specific tests belong to DEC-006 and must execute against PostgreSQL with the real non-bypass API role. SQLite cannot be treated as a tenant-isolation authority.

### 3.4 Outcome normalization

Compare domain outcomes, not raw engine error strings. Each case records fixture ID, expected outcome, engine outcome, constraint category, transaction state and engine/schema version. A parity pass requires all mandatory cases to match; unsupported engine semantics must be recorded as explicit exceptions and cannot be silently skipped.

### 3.5 Harness acceptance

- Pinned PostgreSQL and SQLite versions.
- Identical fixture corpus and schema contract.
- Isolated disposable databases and deterministic cleanup.
- Positive and negative results for every required case.
- Concurrency and rollback tests.
- Schema fingerprints and exact tested commit SHA.
- Complete logs and machine-readable comparison report.
- No ignored failures or unreviewed engine-specific divergence.

## 4. Cross-document reconciliation required before freeze

Review these artifacts together:
- CANONICAL-SCHEMA-DECISION-REGISTER-001
- DOMAIN-AUTHORITY-AND-SUPERSESSION-MATRIX-001
- CANONICAL-PARTICIPANT-RELATIONSHIP-SPEC-001
- CANONICAL-ENTITY-KEY-CONSTRAINT-MAPPING-001
- DOMAIN-DECISION-ACCEPTANCE-MATRIX-001
- INTEGRITY-GAP-RESOLUTION-001
- DEC-006-RLS-POLICY-MATRIX-001
- DEC-006-008-EVIDENCE-REVIEW-001

Reconciliation must verify:
1. No legacy single-enterprise authorization assumption overrides approved multi-tenant DEC-001–005.
2. Tenant, legal party, participant, membership and user identities remain distinct.
3. Every participant, site, assignment and action has consistent composite identity and scope.
4. Lifecycle revocation, expiry, suspension and historical binding behavior fail closed.
5. PostgreSQL is authoritative; SQLite is local/offline persistence only.
6. Web, Mobile and Desktop use the same canonical API identity, action and authorization contract.
7. Supplier operational access cannot confer contract, payment, ledger or goods-release authority.
8. Cross-platform negative-access tests cover forged tenant, participant, membership, site and action identifiers.

Any contradiction or missing evidence is recorded as a blocker, not resolved by assumption.

## 5. Current execution limitations

The current review environment has GitHub repository access but does not expose the user's actual API host/Termux process, its open file descriptors, or a verified host shell session. Therefore DEC-007 runtime inspection has not been performed.

No disposable PostgreSQL/SQLite execution environment has been provisioned or made available in this review session. Therefore DEC-008 harness execution and parity results are not claimed. The harness contract is specified here; it must be materialized and executed in an approved disposable runner before DEC-008 can close.

These limitations are evidence gaps, not successful checks.

## 6. Schema-freeze decision checklist

- [ ] DEC-001–DEC-005 approved domain rules remain intact.
- [ ] Four canonical integrity-gap resolutions accepted and physically reconciled.
- [ ] DEC-006 policy SQL, roles, grants and RLS negative tests pass.
- [ ] DEC-007 actual API SQLite provenance and schema inventory verified.
- [ ] DEC-008 disposable PostgreSQL–SQLite parity suite passes.
- [ ] Temporal/concurrency and rollback behavior verified.
- [ ] Legacy authorization implementation reconciled.
- [ ] Web/Mobile/Desktop API and authorization contracts reconciled.
- [ ] All critical findings closed with source-pinned evidence.
- [ ] Independent review and explicit user decision recorded.

**Final disposition: SCHEMA FREEZE NOT READY.** This package is submitted for review only. No automatic freeze, migration, DDL execution, PR, merge, deployment or live database change is authorized.
