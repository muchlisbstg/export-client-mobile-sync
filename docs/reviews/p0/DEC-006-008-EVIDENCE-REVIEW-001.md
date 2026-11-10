# DEC-006-008-EVIDENCE-REVIEW-001

**Status:** READ-ONLY SOURCE REVIEW — ALL THREE DEC GATES REMAIN OPEN  
**Date:** 2026-11-10  
**Repository:** `muchlisbstg/export-client-mobile-sync`  
**Reviewed ref:** `main` at `0a3c595c6697f56d0cef8536c3b93c3886cc5ab1`  
**Purpose:** Assess whether the current repository contains sufficient evidence to close DEC-006 RLS, DEC-007 SQLite provenance and DEC-008 PostgreSQL–SQLite parity.

## 1. Executive result

| DEC | Review result | Evidence conclusion |
|---|---|---|
| DEC-006 PostgreSQL RLS | **OPEN — NOT IMPLEMENTED / NOT EVIDENCED** | Current authorization source is SQLite-backed application middleware. No PostgreSQL RLS policy, role configuration or RLS integration test was found in the reviewed source inventory. |
| DEC-007 SQLite provenance | **PARTIALLY EVIDENCED — NOT CLOSED** | Source opens SQLite via better-sqlite3 and sets foreign_keys ON in the API startup path. The deployed runtime process, effective database path, embedded SQLite version and all connection paths are not verified. |
| DEC-008 PostgreSQL–SQLite parity | **OPEN — NO PARITY EVIDENCE** | Existing tests use better-sqlite3 in-memory/temp databases. No paired PostgreSQL fixture run or engine-to-engine result set is evidenced. |

**Overall:** no basis to close DEC-006, DEC-007 or DEC-008. Schema freeze remains NOT READY.

## 2. DEC-006 — PostgreSQL RLS

### Evidence inspected

- `server/authorization.mjs` resolves a configured `singleEnterpriseId`, joins `tenants` and `tenant_memberships`, and applies enterprise role middleware. It is application authorization, not PostgreSQL RLS.
- `server/index.mjs` imports `better-sqlite3` and opens a SQLite database.
- `package.json` declares `better-sqlite3`; the reviewed package inventory does not establish a PostgreSQL driver or migration framework.
- `docs/database/TRANSACTION_TENANT_INTEGRITY_DESIGN.md` explicitly records that no PostgreSQL database or RLS integration test has been executed.
- Reviewed test inventory contains SQLite authorization/schema tests; no PostgreSQL RLS integration suite was identified.

### Finding

No reviewed evidence establishes:
- PostgreSQL tenant-owned table policies;
- participant/site/action-scoped RLS policies;
- a non-owner application role without `BYPASSRLS`;
- `FORCE ROW LEVEL SECURITY` decisions;
- transaction-local tenant context and connection-pool reset behavior;
- RLS negative tests for SELECT/INSERT/UPDATE/DELETE and indirect joins.

Application middleware cannot substitute for RLS, and a local SQLite authorization check does not demonstrate PostgreSQL row isolation.

### Closure requirements

1. Inventory every tenant-owned and relationship table in the approved canonical schema.
2. Define policy predicates using authenticated server-side tenant membership and active transaction participant/site/action scope.
3. Define application, migration, owner and background-worker roles; prove the app role cannot bypass RLS.
4. Define transaction-local tenant context, safe pool checkout/check-in and reset on commit/rollback.
5. Test cross-tenant SELECT/INSERT/UPDATE/DELETE, indirect joins, nested queries and stale context on disposable PostgreSQL.
6. Pin PostgreSQL version and capture policy definitions, role attributes, test logs and exact source/schema SHA.

**Disposition:** OPEN. Do not infer RLS from Express middleware, Supabase Auth token verification, or SQLite tests.

## 3. DEC-007 — SQLite runtime provenance

### Evidence inspected

- `server/index.mjs` imports `better-sqlite3`, selects database path as `options.dbPath ?? process.env.API_DB_PATH ?? server/data/api.sqlite`, opens the database and executes `db.pragma("foreign_keys = ON")`.
- `docs/supply-chain-schema.sql` begins with `PRAGMA foreign_keys = ON`, but explicitly says it is a reference schema not yet wired into server startup or an application migration.
- `docs/api-runtime-database-discovery-2026-11-03.md` records that the deployed API service and effective runtime `API_DB_PATH` were not identified; the Termux SQLite file was not verified as the live API database.
- `scripts/inspect-transaction-authorization-schema.mjs` is a read-only SQLite schema inspector.
- Tests instantiate `better-sqlite3` with `:memory:` and temporary file paths. These are test fixtures, not evidence of deployed database identity.

### Finding

Repository source proves a code-path default and a startup PRAGMA, not the identity or schema of the running API database. The inspected material does not establish the embedded SQLite library version in each target runtime, all connection constructors, background worker connections, reopened connections, or the physical deployed schema.

### Closure requirements

1. Identify the actual deployed process/service and exact commit/build.
2. Establish effective database path without disclosing secrets or row data.
3. Capture the SQLite library/runtime version from the same process that opens the database.
4. Enumerate every database connection constructor (API, worker, jobs, tests, reopen paths) and prove `PRAGMA foreign_keys` returns 1 for each.
5. Capture schema-only inventory: tables, columns, PKs, unique/partial indexes, FKs, CHECKs, triggers, migration/version ledger, `integrity_check`, `foreign_key_check`, schema fingerprint.
6. Reconcile that inventory with the canonical mapping; no database file, WAL/SHM, credentials or operational rows are to be exported for this review.

**Disposition:** NOT VERIFIED. Source startup has a positive PRAGMA signal, but deployed provenance and complete connection coverage remain missing.

## 4. DEC-008 — PostgreSQL / SQLite parity

### Evidence inspected

- Existing schema and authorization tests import `better-sqlite3` and use in-memory or temporary SQLite databases.
- `test/schema-reconciliation-contract.test.mjs` verifies that the schema inspector is read-only and reports known missing constraints; it does not prove those constraints exist.
- `docs/supply-chain-schema.sql` is an SQLite reference schema, not a wired migration.
- `docs/database/TRANSACTION_TENANT_INTEGRITY_DESIGN.md` states SQLite synthetic validation and PostgreSQL integration/RLS validation are separate gates and records no PostgreSQL RLS integration test executed.
- No paired PostgreSQL test job, PostgreSQL fixture run, or source-pinned cross-engine parity report was found in the reviewed inventory.

### Finding

SQLite-only tests cannot establish PostgreSQL behavior. A design table mapping equivalent mechanisms is not parity evidence. The current review cannot establish equivalent outcomes for composite FKs, partial unique indexes, temporal overlap/concurrency, trigger semantics, timestamp precision, NULL handling, rollback or RLS.

### Closure requirements

1. Pin exact PostgreSQL and SQLite engine/library versions.
2. Build disposable, isolated databases from the same canonical logical fixture set.
3. Run the same positive and negative corpus against both engines, including all four original composite FKs and the four newly specified integrity relationships.
4. Include concurrent overlapping tenant-binding writes, duplicate Buyer/Seller role inserts, membership cross-tenant mismatch, exact site-link mismatch, revoked membership/site link and rollback behavior.
5. Compare expected acceptance/rejection and normalized outcome classes; record engine-specific error codes separately.
6. Include UTC/half-open interval boundary, NULL, UUID representation and timestamp precision cases.
7. Capture schema hashes, exact test command, logs, commit SHA and reviewer sign-off.

**Disposition:** OPEN. No PostgreSQL/SQLite parity claim is supportable until the same corpus is executed on both pinned engines.

## 5. Source evidence register

| Source | Reviewed SHA | Evidence relevance |
|---|---|---|
| `server/index.mjs` | `e22751d4c976935f8ab5bb29decb6f1043868a53` | SQLite startup, path selection, foreign_keys PRAGMA |
| `server/authorization.mjs` | `2996a3fe928d699c61ddbb13d0fec88f377ffa6f` | Single-enterprise application middleware |
| `package.json` | `bcfae9e438c701576b19b831fece71048c53f9a4` | better-sqlite3 dependency |
| `docs/api-runtime-database-discovery-2026-11-03.md` | `e541eb81b0a9bed7521c1eee5b09a87c769a8460` | Runtime/database identity unresolved |
| `docs/supply-chain-schema.sql` | `3ed460c03d3f98ac880782aeb0c9bb9804475966` | Reference SQLite schema not wired to startup/migration |
| `docs/database/TRANSACTION_TENANT_INTEGRITY_DESIGN.md` | `a21e20c08627622486cfb6dccf00b14bde597b73` | Explicit absence of deployed DB/PostgreSQL RLS evidence |
| `test/schema-reconciliation-contract.test.mjs` | `4e9ccbecff425864d3fe4ba967c565b0909be6ad` | Read-only schema inspection test on SQLite |
| `test/transaction-authorization.test.mjs` | `d09c8b4f83846be36907f9a6d3e0b67314e3c616` | Authorization test uses temp SQLite and single-enterprise setup |

## 6. Governance and next review order

- Four integrity gaps are specified in `INTEGRITY-GAP-RESOLUTION-001.md`; reviewer acceptance remains pending.
- DEC-006 must be designed and tested against the canonical multi-tenant domain, not the legacy single-enterprise middleware.
- DEC-007 requires owner-authorized read-only runtime inventory; repository source inspection is insufficient.
- DEC-008 may use only disposable databases and synthetic fixtures. No production/staging database access is authorized by this review.
- No DDL, migration, source code, configuration, runtime, staging or production mutation was performed.
- Schema freeze and implementation readiness remain **NOT READY**.
