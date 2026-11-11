# P0 RT-03 Read-only Database Inventory — 2026-11-11

**Repository:** `muchlisbstg/export-client-mobile-sync`  
**Inventory branch:** `audit/p0-rt03-readonly-inventory-2026-11-11`  
**Source branch inspected:** `main`  
**Source commit:** `0a3c595c6697f56d0cef8536c3b93c3886cc5ab1`  
**Scope:** GitHub repository tree, source code, configuration examples, migration scripts, and existing discovery/reconciliation documents.  
**Method:** Remote read-only inspection. No application startup, database connection, shell execution, DDL, migration, seed, backfill, write, or operational-data export.  
**Status:** **IN PROGRESS — repository/source inventory recorded; actual runtime database identity and physical schema remain NOT VERIFIED.**

## 1. Executive result

The current repository source describes a Node.js/Express API using `better-sqlite3` as its application database. The source default is `server/data/api.sqlite`, but `.env.api.example` documents an override through `API_DB_PATH`. Neither value establishes which database file, if any, is used by a currently deployed API process.

The repository also contains Supabase Auth configuration placeholders and a separately documented Supabase PostgreSQL staging target. These do not establish that the application business database is PostgreSQL or that the API uses the staging project for persistence.

**RT-03 cannot be marked DONE** until an authorized, read-only inspection identifies the actual running service, its deployment revision and effective database path/connection target, and the physical schema/migration state.

## 2. Evidence provenance

| Evidence | Observed value | Interpretation |
|---|---|---|
| Repository source | `main` at `0a3c595c6697f56d0cef8536c3b93c3886cc5ab1` | Exact source snapshot inspected |
| `package.json` | `dev:api = node server/index.mjs`; dependency `better-sqlite3` | Node/Express API with SQLite driver |
| `server/index.mjs` | `new Database(dbPath)`; default `server/data/api.sqlite`; WAL and foreign keys enabled | Source-defined runtime behavior; not proof of deployed path |
| `.env.api.example` | `API_DB_PATH=./server/data/api.sqlite` | Example only; not effective runtime configuration |
| `.env.api.example` | Supabase URL/anon-key placeholders under backend auth configuration | Auth provider configuration, not proof of business database persistence |
| `scripts/migrate-tenant-isolation.mjs` | SQLite DDL via `db.exec` and transaction wrapper | Migration script can mutate a supplied SQLite database; not executed |
| `scripts/migrate-supply-chain.mjs` | Opens a caller-supplied SQLite path and invokes tenant/supply-chain migration | CLI is mutating; not executed |
| `server/supply-chain.mjs` | Defines supply-chain tables, indexes, and triggers | Source schema declaration only |
| `scripts/inspect-transaction-authorization-schema.mjs` | Reads `sqlite_master` and `PRAGMA foreign_key_list` | Read-only inspector contract; not run against a live database |
| `docs/api-runtime-database-discovery-2026-11-03.md` | Runtime service and live DB identity previously unverified | Existing discovery blocker remains relevant |
| `docs/postgres-staging-migration.md` | Supabase staging described as a separate PostgreSQL target; no staging DDL authorized | Staging target is not production/runtime evidence |

## 3. Source-defined database architecture

### 3.1 Application runtime

- API entrypoint: `server/index.mjs`.
- Framework: Express.
- Database library: `better-sqlite3`.
- Database path resolution: explicit `options.dbPath`, then `API_DB_PATH`, then source default `server/data/api.sqlite`.
- Startup behavior: opens the selected SQLite file, enables WAL and foreign keys, creates core tables if absent, conditionally adds the `products.active` column, and inserts default catalogue rows idempotently.
- Consequence: **do not start the API as an inspection technique**. Startup may create or alter schema and insert rows.

### 3.2 Source schema producers

| Source | Declared responsibility |
|---|---|
| `server/index.mjs` | Core catalogue, inquiry/RFQ, sync conflict, and sync outbox schema |
| `scripts/migrate-tenant-isolation.mjs` | Tenants, memberships, enterprise roles/audit, site assignments, commercial transactions, transaction assignments/site links, tenant outbox |
| `server/supply-chain.mjs` | Sites, lots, genealogy, inventory movements/entries, processing losses, quality inspections, handovers, evidence, and integrity triggers |
| `scripts/migrate-supply-chain.mjs` | CLI wrapper for tenant and supply-chain migration |
| `scripts/inspect-transaction-authorization-schema.mjs` | Read-only transaction/tenant/site composite-FK contract inspection |

The repository's prior source reconciliation records 23 source-defined tables across the core API, tenant/transaction, and supply-chain schema producers. This is a source declaration count, **not** a physical runtime table count.

### 3.3 Migration history

The recursive source tree contains migration scripts and schema reconciliation documentation. No conventional versioned migration directory or authoritative applied-migration ledger was identified in the inspected tree. This finding must be reconciled with the actual runtime database and deployment packaging; absence from the repository tree does not prove no external migration process exists.

## 4. Known source-level integrity exceptions

The current source contract and read-only inspector identify five transaction authorization schema blockers:

1. Missing explicit tenant-to-transaction scope bridge.
2. Missing composite tenant/transaction FK for `transaction_access_assignments`.
3. Missing composite tenant/site FK for `transaction_access_assignments`.
4. Missing composite tenant/transaction FK for `transaction_site_links`.
5. Missing composite tenant/site FK for `transaction_site_links`.

These are source-level findings. No claim is made here about the exact physical runtime schema until it is inspected. Existing ADR and schema design documents remain proposals/evidence, not approval to create or apply DDL.

## 5. Physical runtime inventory — outstanding

| Required fact | Current result | Evidence needed |
|---|---|---|
| Actual API host/service and environment | NOT VERIFIED | Authorized service inventory (EC2/ECS/Lambda/App Runner/other/none) |
| Running deployment revision / source SHA | NOT VERIFIED | Service/task/function deployment metadata |
| Process entrypoint and working directory | Source entrypoint known; live process NOT VERIFIED | Read-only process/service metadata |
| Effective `API_DB_PATH` or DB connection target | NOT VERIFIED | Environment variable names and resolved path/target; redact all values containing secrets |
| Physical DB engine/version | Source suggests SQLite; actual engine NOT VERIFIED | Runtime metadata |
| Actual SQLite file identity/path, if applicable | NOT VERIFIED | Confirmed service-to-file mapping and file metadata |
| Physical tables, columns, indexes, triggers, constraints | NOT VERIFIED | Consistent schema-only read from the confirmed database |
| Roles, grants, ownership, RLS policies and bypass-capable principals (PostgreSQL) | NOT VERIFIED | Read-only catalog inventory from confirmed PostgreSQL instance |
| Applied migration ledger/history | NOT VERIFIED | Physical migration ledger and deployment history |
| Schema fingerprint and integrity checks | NOT VERIFIED | Schema-only artifact, digest, SQLite integrity/FK checks or PostgreSQL equivalents |

## 6. Safe next-step protocol

1. Identify the actual service and deployment revision through authorized read-only cloud/service metadata.
2. Inspect environment variable **names only**; never disclose passwords, tokens, keys, connection strings, or secret values.
3. Confirm the effective database path/target from the running service configuration. Do not infer it from examples, local files, or source defaults.
4. If SQLite is confirmed, use a consistent read-only inspection that accounts for WAL state. Capture schema objects, indexes, triggers, constraints, schema/user versions, SQLite version, `integrity_check`, and `foreign_key_check`; do not copy or expose operational rows.
5. If PostgreSQL is confirmed, capture engine/version, schemas, tables, columns, constraints, indexes, triggers, extensions, roles, grants, ownership, RLS policies, and bypass-capable principals using read-only catalog queries.
6. Reconcile the physical state with source declarations and migration history. Record missing, extra, divergent, and ambiguous objects.
7. Produce a schema-only artifact and SHA-256 digest only after source identity and snapshot consistency are proven.
8. Stop if the service/database identity or consistent snapshot cannot be established.

**Prohibited:** API startup for discovery, migration script execution, DDL, seed/backfill, data mutation, production export, staging mutation, schema freeze, or credential disclosure.

## 7. Reviewer-ready evidence package

This inventory is structured to support future independent peer review without assuming paid reviewer availability. Before inviting a reviewer, prepare:

- This report plus the controlling P0 baseline and current remediation tracker.
- Exact repository, branch, commit SHA, file/blob SHA, and immutable artifact digests.
- A schema-only artifact with provenance and a documented exclusion of all row data and secrets.
- A source-to-physical-schema reconciliation matrix and unresolved exception register.
- Reproducible read-only commands/queries and expected metadata-only output.
- Separate Security and Database review scopes, acceptance criteria, and decision templates.
- Reviewer independence/conflict-of-interest declaration; relevant expertise and review scope.
- A findings log with severity, evidence reference, affected SHA, response, and closure decision.

Potential channels are volunteer peer review, open-source maintainer/community review, or an academic collaboration. A volunteer or academic review must still document identity, relevant competence, scope, conflicts, independence, and exact evidence reviewed. It does not waive the formal independent Security and Database gates.

## 8. Current disposition

- Repository/source inventory: **RECORDED**.
- Actual runtime service and database identity: **NOT VERIFIED**.
- Physical schema and applied migration history: **NOT VERIFIED**.
- Source-level five transaction authorization blockers: **OPEN**.
- Independent Security Review: **BLOCKED — budget unavailable; requirement retained**.
- Independent Database Review: **BLOCKED — budget unavailable; requirement retained**.
- P0 Release Readiness: **BLOCKED**.

No database was connected to, inspected, modified, or exported during this repository-only pass. No implementation, migration, DDL, seed, backfill, deployment, or merge was performed.
