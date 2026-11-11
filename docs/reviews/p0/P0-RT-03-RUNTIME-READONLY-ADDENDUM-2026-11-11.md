# P0 RT-03 Runtime and Connected Infrastructure Read-only Addendum — 2026-11-11

**Parent inventory:** [P0 RT-03 Read-only Database Inventory](P0-RT-03-READONLY-DATABASE-INVENTORY-2026-11-11.md)  
**Repository:** `muchlisbstg/export-client-mobile-sync`  
**Evidence branch:** `audit/p0-rt03-readonly-inventory-2026-11-11`  
**Source repository revision inspected:** `main` at `0a3c595c6697f56d0cef8536c3b93c3886cc5ab1`  
**Inspection time:** 2026-11-11, approximately 05:13 UTC for database catalog queries.  
**Method:** Vercel project/deployment metadata and environment-variable inventory; Supabase project metadata, migration listing, and read-only PostgreSQL catalog queries; GitHub source inspection.  
**Scope:** metadata and schema only. No application rows were read, exported, or modified.

## 1. Executive disposition

This pass verified a Vercel Production deployment of the repository and a separate active Supabase staging database. **It did not establish that the deployed Vercel application/API is connected to that Supabase database.**

The strongest current findings are:

- Vercel has a Production deployment for repository `main` at SHA `0a3c595c6697f56d0cef8536c3b93c3886cc5ab1`, state READY, deployment region `iad1`.
- The Vercel project has zero environment variables returned by the project environment inventory. No effective database URL or API_DB_PATH override was observable there.
- The Vercel project’s latest deployment metadata points to the audit branch at SHA `846c5823f9f43cfc09920504cd83e50d7f0e1203`; the most recent Production-target deployment returned by the Production filter is the main SHA above.
- The repository source describes a standalone Express API using SQLite. Its default DB path is `server/data/api.sqlite`, host `127.0.0.1`, port `4001`. This is source-defined behavior, not proof of the live process configuration.
- The connected Supabase project `export-client-staging` is ACTIVE_HEALTHY, PostgreSQL 17.11, region `ap-south-1` (Mumbai).
- Supabase staging has no application relations in `public`, no project migration records returned by the Supabase migration API, and no `supabase_migrations.schema_migrations` table.
- Therefore, **the Supabase staging database is not proven to be the live application database**, and the actual API process/host/database path remains NOT VERIFIED.

## 2. Vercel service and deployment evidence

### 2.1 Project

| Field | Observed value |
|---|---|
| Project | `export-client-mobile-sync` |
| Project ID | `prj_d7QLVAnsgo7QoDA9xha7fWkbbbC9` |
| Connected Git repository | `muchlisbstg/export-client-mobile-sync` |
| Framework metadata | `null` |
| Configured Node version | `26.x` |
| Project domains | `export-client-mobile-sync.vercel.app` and Vercel-generated aliases |

### 2.2 Latest Production-target deployment

| Field | Observed value |
|---|---|
| Deployment ID | `dpl_7htFkCME5YMAWfPw7vemATRsc1PJ` |
| Target | `production` |
| State | `READY` |
| Deployment type | `LAMBDAS` |
| Created | `2026-11-08T06:59:50.084Z` |
| Git ref | `main` |
| Git SHA | `0a3c595c6697f56d0cef8536c3b93c3886cc5ab1` |
| Region | `iad1` |
| Deployment URL | https://export-client-mobile-sync-5vhhy7q7d-muchlisbustang-1528.vercel.app |
| Inspector | https://vercel.com/muchlisbustang-1528/export-client-mobile-sync/7htFkCME5YMAWfPw7vemATRsc1PJ |

This proves that Vercel recorded a READY Production-target deployment for the repository revision. It does **not**, by itself, prove that the Express API in `server/index.mjs` is running as a Vercel function or that this deployment serves the authoritative API.

### 2.3 Environment configuration

The Vercel project environment inventory returned:

- Environment variable records: **0**
- Hidden Production environment variable count: **0**
- No decrypted values were requested or accessed.

Consequently, no Vercel-managed `DATABASE_URL`, `API_DB_PATH`, `SUPABASE_URL`, or other effective DB connection setting was observed. This does not rule out configuration outside this Vercel project/account.

### 2.4 Runtime observability

- Production runtime log query for the latest 30 minutes returned no records.
- Runtime error aggregation for the last 7 days returned no runtime errors.
- A 24-hour individual runtime-log query was rejected because the available plan did not retain that requested window; the 30-minute query was used instead.

Absence of returned logs/errors is not proof that the API was invoked or is healthy.

## 3. Repository source-to-deployment reconciliation

At inspected `main` SHA `0a3c595c6697f56d0cef8536c3b93c3886cc5ab1`:

| Source evidence | Blob SHA | Observed behavior |
|---|---|---|
| `package.json` | `bcfae9e438c701576b19b831fece71048c53f9a4` | Expo app entrypoint; `dev:api` invokes `node server/index.mjs`; dependency `better-sqlite3` and Express |
| `server/index.mjs` | `e22751d4c976935f8ab5bb29decb6f1043868a53` | Standalone Express server; opens SQLite database; default host `127.0.0.1`, port `4001`, path `server/data/api.sqlite`; startup block runs when invoked as a script |
| `.env.api.example` | `f55caa02a38822a6f9c490e5261863b11909e6c9` | Documents `API_DB_PATH=./server/data/api.sqlite`; Supabase Auth variables are blank placeholders |
| `.env.example` | `a2878c59c77d78da01d2838699556d7cfe5e8ecb` | Leaves `EXPO_PUBLIC_API_URL` unset by default and documents local platform defaults |

The recursive Git tree for this source SHA did not contain a root `vercel.json` or conventional `api/` function directory. The server source exposes `createServer` and starts an HTTP listener when executed directly; the inspected source does not establish a Vercel request-handler adapter.

**Conclusion:** Vercel Production deployment identity is verified; the identity and runtime configuration of the authoritative Express API are not. The API may be hosted separately, may be intended for local operation, or may require a deployment adapter/configuration not evidenced in the inspected source. Do not assume any of these possibilities.

## 4. Supabase staging project identity

| Field | Observed value |
|---|---|
| Project | `export-client-staging` |
| Project ref | `utvxuzmtevnmrcpxfpaa` |
| Status | `ACTIVE_HEALTHY` |
| Region | `ap-south-1` (Mumbai) |
| Database host | `db.utvxuzmtevnmrcpxfpaa.supabase.co` |
| Database name | `postgres` |
| Engine | PostgreSQL |
| Version | `17.11` (`server_version_num=170011`) |
| Catalog inspection role | `postgres` |
| Catalog inspection time | `2026-11-11T05:13:18.444376Z` |
| Supabase project URL | https://utvxuzmtevnmrcpxfpaa.supabase.co |

The project is an active staging project. Its existence does not prove application connectivity or establish it as the live API database.

## 5. Physical catalog inventory — staging database only

Read-only PostgreSQL catalog inspection returned:

| Catalog scope | Count/result |
|---|---:|
| Relations (tables/partitioned tables/views/materialized views/foreign tables) | 44 |
| Columns | 451 |
| Constraints | 142 |
| Indexes | 145 |
| Non-internal triggers | 12 |
| RLS-enabled tables | 26 |
| RLS policies visible in `pg_policies` | 0 |
| Table grants | 369 |
| Non-`pg_*` roles | 15 |
| Installed extensions | 5 |
| Routines/functions and procedures | 109 |
| Invalid/not-ready indexes | 0 |
| Unvalidated constraints | 1 |
| Application relations in `public` | **0** |

Relations are distributed across provider/platform schemas:

| Schema | Relations |
|---|---:|
| `auth` | 27 |
| `extensions` | 2 |
| `realtime` | 3 |
| `storage` | 10 |
| `vault` | 2 |
| **Total** | **44** |

No application/business table was observed in `public`. The 44 relations are provider/platform schema objects, not Export Client business schema.

### 5.1 Constraints and indexes

- No invalid or not-ready indexes were reported by `pg_index`.
- One unvalidated constraint was reported: `realtime.messages.messages_payload_exclusive`, a provider-managed `CHECK ... NOT VALID` constraint.
- The other 141 catalog constraints were reported as validated.
- This is a catalog-state check, not a full physical page/index verification or application data-integrity test.

### 5.2 RLS and roles

- 26 provider-schema tables report RLS enabled; none of those tables report FORCE ROW LEVEL SECURITY.
- The catalog query returned zero policies in `pg_policies`.
- The connection used the `postgres` role, which has `BYPASSRLS` in the observed role flags.
- Provider-managed privileged roles include `service_role` and `supabase_admin`, which also have RLS-bypass/superuser capabilities as shown by catalog flags.

These are platform-level observations. They do not constitute a review of the application's runtime database role, trusted identity provenance, or tenant authorization. No application-owned tables or policies were present in `public` to test.

### 5.3 Installed extensions

Five extensions were installed at inspection time: `pg_stat_statements 1.11`, `pgcrypto 1.3`, `plpgsql 1.0`, `supabase_vault 0.3.1`, and `uuid-ossp 1.1`.

The `amcheck` extension was not among the installed extensions. No page-level `amcheck`/physical storage verification was performed.

## 6. Migration history

- Supabase migration-list API returned **zero project migration records**.
- `supabase_migrations.schema_migrations` was absent.
- `public.schema_migrations` was absent.
- Provider-owned `auth.schema_migrations`, `realtime.schema_migrations`, and `storage.migrations` are not evidence of Export Client application migration history.
- Repository source contains SQLite migration scripts, but no physical evidence links those scripts to this Supabase staging project.

**Disposition:** project migration history and runtime schema provenance are NOT VERIFIED; the connected staging database has no observed application migration ledger.

## 7. Schema fingerprint and integrity evidence

A deterministic metadata-only SHA-256 fingerprint was computed from sorted catalog definitions for:

- Non-system schemas and relation identities/owners/RLS flags.
- Column names, ordinal positions, data types, nullability, defaults, identity/generated flags.
- Constraint definitions and validation flags.
- Index definitions.
- Non-internal trigger definitions and enabled states.
- RLS policy definitions.
- Table grants.
- Non-`pg_*` role capability flags.
- Non-system routine definitions.
- Installed extension names and versions.

<badge color="success">Fingerprint captured</badge>

```text
Database: postgres
Engine: PostgreSQL 17.11
Inspected at: 2026-11-11T05:13:18.444376Z
Canonical schema SHA-256:
4b8766e34c456286a0904c6a9df0058cd1c5341a39f9a727c85bfa182b39c520
```

This fingerprint is for the observed Supabase staging catalog snapshot only. It is not a fingerprint of the Vercel runtime, SQLite file, or any unidentified API host. Recompute it after any schema/provider change before comparing snapshots.

### Integrity scope and limitations

- Catalog integrity metadata: no invalid indexes; one provider-managed unvalidated constraint.
- No application tables in `public`; therefore no application FK/orphan, business-row, tenant-isolation, or transaction-integrity checks were applicable.
- No application rows were read.
- No `amcheck` page-level validation was run.
- No live SQLite database file was accessible through the connected read-only providers, so SQLite `integrity_check` and `foreign_key_check` were not run.
- A clean catalog check must not be represented as a full database integrity PASS.

## 8. Outstanding evidence required to close RT-03

1. User/organization confirms the actual API hosting provider and service name (if separate from Vercel).
2. Authorized read-only service metadata identifies the live API process, runtime, entrypoint, deployment revision, and listening endpoint.
3. Effective environment configuration is inspected by variable **name and redacted presence/status only**; never export secret values.
4. The running process's actual database target is confirmed. For SQLite, establish the exact file identity/path and WAL snapshot; for PostgreSQL, establish the exact project/database/role.
5. Physical schema, migration history, role/grant/policy state, and schema fingerprint are collected from that confirmed runtime target.
6. Run only safe read-only integrity checks supported by the actual engine. Any page-level or full data checks require a separately approved plan and resource assessment.

## 9. Governance and safety record

- RT-01 remains **BLOCKED — budget unavailable**; independent Security and Database reviews remain mandatory.
- RT-03 remains **IN PROGRESS**; this addendum advances connected-provider discovery but does not close runtime API identity.
- P0 Release Readiness remains **BLOCKED**.
- No implementation, migration, DDL, seed, backfill, database mutation, deployment, production configuration change, PR merge, or `main` write was performed.
- No secrets or application row data were accessed or included.


## 10. Infrastructure target clarification — Hostinger — 2026-11-11

The project owner confirmed that **Hostinger is the intended future hosting target, but it has not yet been funded**.

| Attribute | Current disposition |
|---|---|
| Intended provider | Hostinger |
| Target status | **PLANNED — UNFUNDED** |
| Funding | Not available / not yet budgeted |
| Service plan or product | NOT SELECTED / NOT VERIFIED |
| Hostinger account/service identifier | NOT PROVIDED / NOT VERIFIED |
| VPS, shared/cloud hosting instance, IP, SSH endpoint | NOT PROVISIONED / NOT VERIFIED |
| API process on Hostinger | NOT DEPLOYED / NOT VERIFIED |
| Actual API database path/connection | NOT VERIFIED |

This is an owner-confirmed deployment intention, not infrastructure evidence. It must not be represented as an active Hostinger account, purchased plan, provisioned server, deployed service, or database endpoint. No Hostinger account or server was accessed in this evidence pass.

### 10.1 RT-03 workstream decomposition

- **RT-03A — Source Inventory: RECORDED.** Repository source defines an Express API using `better-sqlite3`, default SQLite path `server/data/api.sqlite`, optional `API_DB_PATH`, and repository migration scripts. Source declarations do not prove a live SQLite file or applied migration state.
- **RT-03B — Infrastructure Target: RECORDED.** Hostinger is **PLANNED — UNFUNDED**. No service provisioning or deployment is implied.
- **RT-03C — Staging Inventory: RECORDED WITH RECONCILIATION NOTE.** Supabase `export-client-staging` is PostgreSQL 17.11 in Mumbai and its catalog evidence is preserved in this addendum. It is not proven to be API-connected and has no observed Export Client business relations in `public`.
- **RT-03D — Runtime Verification: NOT STARTED / BLOCKED BY PROVISIONING.** Begin only after hosting is funded and the actual service is provisioned, with authorized read-only access to service/deployment metadata and effective configuration.
- **RT-03E — Database Integrity: NOT STARTED / BLOCKED BY CONFIRMED CONNECTION.** Begin only after the actual application database is identified and a consistent read-only snapshot is available. Do not substitute the Supabase staging snapshot for an unidentified API database.

### 10.2 Staging snapshot reconciliation note

The historical evidence in this addendum contains two catalog summaries with different counts/fingerprints: the normalized catalog summary reports 26 RLS-enabled relations and fingerprint `4b8766e34c456286a0904c6a9df0058cd1c5341a39f9a727c85bfa182b39c520`; a separately appended earlier provider inventory reports 27 RLS-enabled tables and fingerprint `093732f97225a4abf3656c3285e295295bba158d7297a80de185942ce2362ded`. These values are retained as distinct recorded evidence and must not be silently treated as the same canonical snapshot. Query scope/canonicalization and snapshot provenance require reconciliation before using them for a before/after comparison or a database-integrity conclusion.

### 10.3 Current safety disposition

- No Hostinger account, plan, server, API process, or database was provisioned or accessed.
- No deployment, configuration mutation, database connection, DDL, migration, seed, backfill, or data mutation was performed.
- RT-03 remains **IN PROGRESS**; P0 Release Readiness remains **BLOCKED**.
- Independent Security and Database reviews remain mandatory; reviewer funding remains **BLOCKED — budget unavailable**.
