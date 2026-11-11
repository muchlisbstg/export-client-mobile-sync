# P0 RT-03A–RT-03E Status and Evidence Matrix — 2026-11-11

**Repository:** `muchlisbstg/export-client-mobile-sync`  
**Documentation branch:** `docs/rt03-hostinger-unfunded-2026-11-11`  
**Controlling baseline:** P0 Release Readiness Deep Audit, commit `03221982c06de2ebce23000c703baff3b1e8200b`  
**Overall RT-03 status:** **IN PROGRESS**  
**Overall P0 Release Readiness:** **BLOCKED**

## Purpose

This matrix separates repository intent, future infrastructure intent, connected staging evidence, live runtime proof, and actual-database integrity evidence. Evidence from one category must not be used to claim completion of another.

## RT-03A — Source Inventory

<badge color="success">RECORDED</badge>

**Scope:** Repository-defined API, SQLite configuration, and migration source.

| Item | Evidence / finding | Interpretation |
|---|---|---|
| API entrypoint | `server/index.mjs` | Express API source entrypoint |
| Database driver | `better-sqlite3` | Source-defined SQLite integration |
| Default database path | `server/data/api.sqlite` | Default only; not proof of an existing live file |
| Override | `API_DB_PATH` | Runtime effective value not verified |
| Default listener | `127.0.0.1:4001` | Source default only |
| Migration sources | `scripts/migrate-tenant-isolation.mjs`, `scripts/migrate-supply-chain.mjs` | Mutating migration scripts; not executed |
| Schema source | `server/index.mjs`, `server/supply-chain.mjs` | Source declarations only; not physical schema proof |
| Migration ledger | No authoritative application ledger identified in the inspected repository/staging evidence | Applied migration state remains NOT VERIFIED |

**Evidence:** [RT-03 source inventory](P0-RT-03-READONLY-DATABASE-INVENTORY-2026-11-11.md).  
**Boundary:** no API startup, migration execution, DDL, seed, backfill, or database write was performed.

## RT-03B — Infrastructure Target

<badge color="warning">PLANNED — UNFUNDED</badge>

**Owner-confirmed target:** Hostinger.

| Item | Current status |
|---|---|
| Hosting provider target | Hostinger |
| Funding | Not yet budgeted / unavailable |
| Plan/product | NOT SELECTED / NOT VERIFIED |
| Account/service ID | NOT PROVIDED / NOT VERIFIED |
| VPS/shared/cloud instance | NOT PROVISIONED / NOT VERIFIED |
| IP/SSH endpoint | NOT PROVIDED / NOT VERIFIED |
| API process/deployment | NOT DEPLOYED / NOT VERIFIED |
| Runtime database | NOT VERIFIED |

**Audit interpretation:** Hostinger is a future deployment target only. Do not describe it as active infrastructure, a purchased plan, a running server, or an available API/database endpoint. No Hostinger control plane was accessed.

## RT-03C — Staging Inventory

<badge color="success">RECORDED — STAGING ONLY</badge>

**Connected project:** `export-client-staging`  
**Project ref:** `utvxuzmtevnmrcpxfpaa`  
**Region:** `ap-south-1` (Mumbai)  
**Engine:** PostgreSQL 17.11  
**Database:** `postgres`

Evidence includes read-only catalog metadata, relation/column/constraint/index/trigger inventories, role/grant/RLS metadata, migration-list checks, and metadata-only schema fingerprints. The inspected staging project had no Export Client business relations in `public` and no observed application migration ledger.

Two historical catalog summaries are preserved in the runtime addendum:
- Normalized catalog summary: 26 RLS-enabled relations; fingerprint `4b8766e34c456286a0904c6a9df0058cd1c5341a39f9a727c85bfa182b39c520`.
- Earlier appended provider inventory: 27 RLS-enabled tables; fingerprint `093732f97225a4abf3656c3285e295295bba158d7297a80de185942ce2362ded`.

These are not to be treated as one interchangeable fingerprint. Query scope/canonicalization and snapshot provenance must be reconciled before comparison. Neither fingerprint proves the actual API database identity or physical storage integrity.

**Evidence:** [RT-03 runtime and staging addendum](P0-RT-03-RUNTIME-READONLY-ADDENDUM-2026-11-11.md).

## RT-03D — Runtime Verification

<badge color="warning">NOT STARTED — WAITING FOR HOSTING PROVISIONING</badge>

**Entry condition:** Hostinger (or another explicitly confirmed actual provider) is funded/provisioned and the owner provides authorized read-only access.

Required evidence:
1. Provider account/service and instance identity.
2. Running service/process, runtime, entrypoint, working directory, listening endpoint, and deployment revision.
3. Exact repository/source SHA for the deployed API.
4. Environment variable names and redacted presence/status only; never export secrets.
5. Effective database target/path resolved from the running service configuration.
6. Service-to-database mapping and evidence that the database belongs to this API runtime.

**Stop conditions:** if service identity, deployment SHA, effective database target, or consistent snapshot cannot be established, stop and retain NOT VERIFIED. Do not infer the API runtime from Vercel Web deployment metadata or Supabase project existence.

## RT-03E — Actual Database Integrity

<badge color="warning">NOT STARTED — WAITING FOR CONFIRMED DATABASE</badge>

**Entry condition:** RT-03D identifies the actual API-connected database and an authorized, consistent, read-only snapshot can be obtained.

Required evidence, selected by confirmed engine:

- **SQLite:** engine/version, database file identity/path and WAL snapshot provenance, schema objects, migration/user versions, `PRAGMA integrity_check`, and `PRAGMA foreign_key_check`.
- **PostgreSQL:** engine/version, schema/relation/column inventory, constraints, indexes, triggers, extensions, migration ledger, roles, grants, ownership, RLS policies, bypass-capable principals, and schema fingerprint. Physical/page-level verification such as `amcheck` requires a supported installation and separately assessed execution plan.

Integrity results must state exact database identity, time, role, query/check scope, limitations, and artifact digest. Catalog-only checks must not be called a full physical database integrity PASS.

## Status and governance

| Workstream | Status | Exit condition |
|---|---|---|
| RT-03A Source Inventory | RECORDED | Source facts and migration files cited |
| RT-03B Infrastructure Target | PLANNED — UNFUNDED | Funding/provisioning evidence recorded; no assumed runtime |
| RT-03C Staging Inventory | RECORDED — STAGING ONLY | Provenance and fingerprint reconciliation completed for comparisons |
| RT-03D Runtime Verification | NOT STARTED | Actual service and DB connection identity verified read-only |
| RT-03E Database Integrity | NOT STARTED | Checks run against confirmed actual API database |
| RT-03 overall | IN PROGRESS | RT-03A–E evidence reconciled and required review recorded |

- RT-01 remains **BLOCKED — budget unavailable**. Independent Security and Database reviews remain mandatory and cannot be waived.
- No implementation, database mutation, DDL, migration, seed, backfill, deployment, production configuration change, merge, or `main` write is authorized by this document.
- No PASS or DONE is claimed for RT-03D, RT-03E, or overall RT-03.
