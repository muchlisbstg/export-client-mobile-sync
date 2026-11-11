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


## 9. Connected-provider runtime and staging evidence — 2026-11-11

**Inspection mode:** provider metadata and SQL catalog reads only. No environment-variable values, passwords, keys, tokens, or business rows were requested or exported. SQL statements were SELECT-only.

### 9.1 Vercel deployment discovery

A connected Vercel project named `export-client-mobile-sync` was found:

| Attribute | Observed value |
|---|---|
| Vercel project ID | `prj_d7QLVAnsgo7QoDA9xha7fWkbbbC9` |
| Connected Git repository | `muchlisbstg/export-client-mobile-sync` |
| Production deployment ID | `dpl_7htFkCME5YMAWfPw7vemATRsc1PJ` |
| Production state | `READY` |
| Production target | `production` |
| Production source branch | `main` |
| Production source SHA | `0a3c595c6697f56d0cef8536c3b93c3886cc5ab1` |
| Runtime region | `iad1` (Vercel region identifier) |
| Aliases | `export-client-mobile-sync.vercel.app` and Vercel-generated aliases |
| Project SSO protection | Enabled for all except custom domains |
| Vercel environment variables | No entries returned; hidden production variable count 0 |
| Recent function logs | No function log groups returned for the sampled latest 30-minute window |

A newer Vercel deployment exists for the audit branch at SHA `846c5823f9f43cfc09920504cd83e50d7f0e1203`, but its deployment target is null; it is not the production-target deployment.

The production Vercel deployment is evidence of a production-target deployment of the repository's Web project. It is **not evidence that the Express API is running there**:
- No root `vercel.json` was found.
- The repository tree contains no root `api/` serverless route directory.
- The API entrypoint is `server/index.mjs`, launched by the package script `dev:api` as a standalone Node process.
- The API source opens SQLite directly and resolves `API_DB_PATH` from runtime options/environment/default.
- The Vercel environment-variable listing returned no variables, including no visible `API_DB_PATH` or `SUPABASE_URL` names.
- The deployment file-tree endpoint returned 404 (file tree unavailable); direct endpoint verification was not completed because the Vercel project has SSO protection and the web fetch could not access the deployment.

**Conclusion:** Vercel Web deployment is identified; the actual Express API service/host and its effective database configuration remain **NOT VERIFIED**. Do not infer that the Web deployment is the API host.

### 9.2 Supabase staging database — live metadata snapshot

A connected Supabase project named `export-client-staging` was inspected:

| Attribute | Observed value |
|---|---|
| Project ref | `utvxuzmtevnmrcpxfpaa` |
| Project status | `ACTIVE_HEALTHY` |
| Region | `ap-south-1` (Mumbai) |
| Database host | `db.utvxuzmtevnmrcpxfpaa.supabase.co` |
| Database port | `5432` |
| Database name | `postgres` |
| Engine/version | PostgreSQL `17.11.0.011` / engine major `17` |
| Server encoding / timezone | UTF8 / UTC |
| Catalog inspection session role | `postgres` (`rolbypassrls=true`) |

This is the known **staging** database target, not a proven database connection used by the deployed Express API. The catalog inspection was performed using an elevated administrative role; it does not establish the privileges or identity of an application runtime role.

### 9.3 Physical catalog inventory of the staging project

The read-only catalog query returned the following counts across non-system schemas:

| Object/control | Observed count |
|---|---:|
| Tables (including platform-managed schemas) | 41 |
| Views/materialized views | 3 |
| Indexes | 145 |
| Constraints | 142 |
| — Primary keys | 41 |
| — Foreign keys | 30 |
| — Unique constraints | 13 |
| — Check constraints | 58 |
| Triggers | 15 |
| Database roles (excluding built-in `pg_*` roles) | 15 |
| Table privilege grant rows | 369 |
| Tables with RLS enabled | 27 |
| Tables with FORCE ROW LEVEL SECURITY | 0 |
| Policies returned by `pg_policies` | 0 |

**Application-schema finding:** schema `public` contains **zero tables and zero relations**. The 41 tables are in Supabase-managed `auth`, `realtime`, `storage`, and `vault` schemas. No Export Client business tables were found in this staging project.

The catalog includes privileged platform roles. The current inspection role `postgres`, `service_role`, `supabase_admin`, `supabase_etl_admin`, and `supabase_read_only_user` have `BYPASSRLS` according to the role catalog; `supabase_admin` is also marked superuser. These are platform/database roles, not evidence of an application runtime identity. No role was created or changed.

### 9.4 Migration history reconciliation

- Supabase project migration-list API returned an empty application migration list.
- Platform-managed migration ledgers exist:
  - `auth.schema_migrations`: 82 versions (first `00`, latest `20260831180000`).
  - `realtime.schema_migrations`: 91 versions (first `20211116024918`, latest `20261009120000`).
  - `storage.migrations`: 80 versions (first `add_owner_id_column_deprecate_owner`, latest `vector-buckets`).
- These are Supabase service-component migration ledgers, not Export Client application migration history.
- No application business schema or application migration ledger was identified in `public`.

**Conclusion:** the connected staging project has platform-managed PostgreSQL objects but no Export Client application schema or recorded application migrations. This does not establish whether a separate runtime database exists elsewhere.

### 9.5 Integrity and security metadata

- Catalog validation returned one unvalidated constraint: `realtime.messages.messages_payload_exclusive`, a platform-managed `CHECK (payload IS NULL OR binary_payload IS NULL) NOT VALID`.
- No other unvalidated constraints were returned in the inspected catalog.
- The `amcheck` extension is not installed. No physical heap/index integrity check or `pg_amcheck` run was performed.
- Supabase Health Advisor returned no lints.
- Supabase Security Advisor returned one warning: **Leaked Password Protection Disabled**.
- No application tables exist in `public`, so no Export Client business-row referential-integrity scan could be performed.
- The absence of a Health Advisor lint is not a physical database integrity proof.

### 9.6 Staging schema metadata fingerprint

A SHA-256 fingerprint was generated from a canonical, sorted catalog representation covering non-system schema ownership, relation metadata, columns/defaults/nullability, constraints and validation state, indexes, triggers, RLS policies, function definitions, non-`pg_*` role attributes, table privilege grant rows, and installed extensions.

| Attribute | Value |
|---|---|
| Fingerprint | `093732f97225a4abf3656c3285e295295bba158d7297a80de185942ce2362ded` |
| Canonical metadata bytes | 264,929 |
| Catalog items | 1,452 |
| Scope | Supabase `export-client-staging` snapshot only |
| Data rows included | No |

This is a point-in-time **catalog metadata fingerprint**, not a fingerprint of an application production database. It does not prove runtime connection provenance or physical storage integrity. Recompute with the same canonicalization query and scope before comparing future snapshots.

### 9.7 Remaining access gap and next safe action

The actual Express API service remains unidentified. Existing repository discovery notes designate AWS Console `ap-southeast-1` (Singapore) as the investigation target, but no AWS account/service connector is available in this session. The AWS account inventory has therefore **not** been performed. Hostinger or any other VPS/provider runtime has likewise not been confirmed.

To close the remaining gap, the owner must provide authorized read-only access to the actual hosting control plane (or its service inventory export) and identify whether the API is on AWS, a VPS/Hostinger, another managed Node host, or not deployed. Then record the running service, deployment SHA, process entrypoint, working directory, effective database variable name and resolved target (redacting all secret values), and database-to-service mapping. Only after that identity is proven should the physical runtime database catalog be inspected.

### 9.8 Updated RT-03 disposition

- Vercel production Web deployment: **IDENTIFIED**.
- Express API host/process: **NOT VERIFIED**.
- Supabase staging project and PostgreSQL engine/version/location: **IDENTIFIED**.
- Supabase staging physical catalog: **INVENTORIED**; no Export Client business schema present.
- Actual API-connected database engine/version/location: **NOT VERIFIED**.
- Actual API database schema and migration history: **NOT VERIFIED**.
- Staging catalog metadata fingerprint: **RECORDED**.
- Physical storage integrity: **NOT VERIFIED**.
- RT-03 overall: **IN PROGRESS**.
- P0 Release Readiness: **BLOCKED**.

No application code, environment configuration, deployment, database schema, migration, DDL, seed, backfill, role, grant, or business data was changed.


## 10. Future infrastructure target — Hostinger — 2026-11-11

The owner confirmed Hostinger as the intended future hosting target, but the service has **not yet been funded**.

| Attribute | Status |
|---|---|
| Hosting provider target | Hostinger |
| Target classification | **PLANNED — UNFUNDED** |
| Purchased plan / service tier | NOT SELECTED / NOT VERIFIED |
| Account/service ID | NOT PROVIDED / NOT VERIFIED |
| VPS/shared/cloud instance, IP, SSH | NOT PROVISIONED / NOT VERIFIED |
| API deployment/process | NOT DEPLOYED / NOT VERIFIED |
| Effective database connection | NOT VERIFIED |

This clarification records deployment intent only. It is not proof of an active Hostinger account or runtime. Do not attempt runtime discovery or database integrity checks against a presumed Hostinger service until provisioning and authorized read-only access are available.

### 10.1 RT-03A–RT-03E status

- **RT-03A — Source Inventory: RECORDED.** Express/SQLite configuration and migration source files are documented above. Source files do not prove a live DB file or applied migration ledger.
- **RT-03B — Infrastructure Target: RECORDED.** Hostinger is **PLANNED — UNFUNDED**.
- **RT-03C — Staging Inventory: RECORDED.** Supabase staging evidence is preserved in the runtime addendum; it is not proven API-connected.
- **RT-03D — Runtime Verification: NOT STARTED.** Trigger only after the actual hosting service is funded/provisioned and its identity can be verified read-only.
- **RT-03E — Database Integrity: NOT STARTED.** Trigger only after the actual API database connection target and consistent snapshot are confirmed.

RT-03 overall remains **IN PROGRESS**. P0 Release Readiness remains **BLOCKED**.
