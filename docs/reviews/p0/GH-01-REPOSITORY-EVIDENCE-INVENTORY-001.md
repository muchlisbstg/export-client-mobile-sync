# GH-01-REPOSITORY-EVIDENCE-INVENTORY-001

**Status:** READ-ONLY SOURCE REVIEW — CRITICAL ARCHITECTURE DIVERGENCE IDENTIFIED
**Date:** 2026-11-10
**Repository:** muchlisbstg/export-client-mobile-sync
**Branch:** review/p0-domain-schema-readonly-2026-11-10
**Review baseline:** 11657fcf4057f83172df5a831007cbcf571f2119
**Method:** GitHub source inspection only; no runtime, database, CI workflow execution or deployment inspection.

## 1. Executive finding

The reviewed source does not yet implement the approved multi-tenant PostgreSQL-authoritative architecture. The API entrypoint opens a local SQLite database through better-sqlite3; its authorization middleware is configured around one `singleEnterpriseId`; the mobile API client has only a platform-default base URL and does not attach a canonical tenant/membership/participant context to its inquiry API calls. The reviewed README describes an Expo/React Native mobile application and peer replication, not a verified shared PostgreSQL transaction service or a desktop client implementation.

These are source-level observations, not claims about an unknown deployed runtime. They constitute a **CRITICAL reconciliation blocker** against the approved DEC-001–005 baseline and the intended Web/Mobile/Desktop contract.

## 2. Pinned source evidence

| Evidence | Blob SHA | Source observation | Review impact |
|---|---|---|---|
| `package.json` | `bcfae9e438c701576b19b831fece71048c53f9a4` | Expo/React Native project; `better-sqlite3`; scripts include `dev:api`, `web`, `export:web`; no PostgreSQL driver dependency visible in the manifest | Mobile/Web project plus SQLite API runtime; PostgreSQL execution path not evidenced by this manifest |
| `server/index.mjs` | `e22751d4c976935f8ab5bb29decb6f1043868a53` | Imports `better-sqlite3`; resolves `dbPath` from options, `API_DB_PATH`, or `server/data/api.sqlite`; opens `new Database(dbPath)`; enables WAL and `foreign_keys` | API source opens SQLite directly; does not establish PostgreSQL as authoritative shared transaction DB |
| `server/authorization.mjs` | `2996a3fe928d699c61ddbb13d0fec88f377ffa6f` | `createEnterpriseAuthorization({ db, singleEnterpriseId })`; tenant schema readiness is checked in SQLite; membership lookup is constrained to one configured enterprise; request tenant header must equal that ID | Legacy single-enterprise authorization conflicts with multi-tenant participant model |
| `server/auth.mjs` | `e0e2603de973405e2b26b57f2c1bfa0d7072aab7` | Authenticates bearer token through Supabase Auth user endpoint; identity result contains user ID and admin/customer classification | Identity verification exists, but it is not equivalent to canonical tenant/participant/action authorization |
| `server/supply-chain-routes.mjs` | `ae4ccb7f54bb59aed4fb62e13f00e4c19a81bd85` | Route handlers query SQLite; scope uses active tenant, role/site-type checks and `supply_site_assignments` keyed by tenant/user/site | Existing operational scope is not shown to use the approved transaction participant + exact transaction-site-link + action-assignment chain |
| `src/api.ts` | `fdad8ededf66c5383aff972cb243360b0f1d1ba3` | API URL uses `EXPO_PUBLIC_API_URL` or Android emulator / loopback defaults; delegates to `src/api-core` | Runtime endpoint is configurable; source defaults are not deployment provenance |
| `src/api-core.ts` | `c6e00a6887e7721ae35653e83e3c67de832affce` | Inquiry client sends JSON requests; no canonical tenant/membership/participant/action context is present in the reviewed client contract | Mobile contract is not reconciled to approved canonical multi-party authorization contract |
| `App.tsx` | `8170480460327ddbbcafad4095d6d145a9a34d45` | Expo React Native app; login calls Supabase Auth then backend session/enterprise endpoints | Mobile app still consumes enterprise session/roles |
| `app.json` | `e25944cef53c5b1655fddaa3c83b56b6a9bcbccb` | Expo config includes iOS, Android and Metro web output; no desktop target configuration visible | No desktop app target established by this file |
| `docs/supply-chain-schema.sql` | `3ed460c03d3f98ac880782aeb0c9bb9804475966` | Explicitly labels itself SQLite reference schema and says it is not wired into startup or an application migration | Cannot be treated as the live physical schema |
| `docs/database/TRANSACTION_TENANT_INTEGRITY_DESIGN.md` | `a21e20c08627622486cfb6dccf00b14bde597b73` | Design-only; records missing transaction-party bridge/composite-FK blockers and says no deployed DB inspected | Prior integrity design cannot be treated as physical constraint proof |
| `docs/api-runtime-database-discovery-2026-11-03.md` | `e541eb81b0a9bed7521c1eee5b09a87c769a8460` | Runtime service and effective DB path were not identified | DEC-007 remains unproven |

All URLs are available from the corresponding file paths on this branch:
- `server/index.mjs`
- `server/authorization.mjs`
- `server/auth.mjs`
- `server/supply-chain-routes.mjs`
- `src/api.ts`
- `src/api-core.ts`
- `App.tsx`
- `app.json`
- `docs/supply-chain-schema.sql`
- `docs/database/TRANSACTION_TENANT_INTEGRITY_DESIGN.md`
- `docs/api-runtime-database-discovery-2026-11-03.md`

## 3. Gate-by-gate assessment

### DEC-006 — RLS

**NOT IMPLEMENTED / NOT TESTED IN THE REVIEWED SOURCE.** The API entrypoint opens SQLite, and the reviewed package manifest does not show a PostgreSQL driver or PostgreSQL RLS test dependency. No evidence was found in the reviewed files for PostgreSQL RLS policy SQL, API database role attributes, grants, FORCE RLS configuration or RLS-001–018 execution. This is a scoped source inspection, not a complete repository-wide absence proof.

### DEC-007 — actual API SQLite provenance

**OPEN.** Source establishes how a process could select a SQLite path, not which file the actual API process has open. No PID/container, process file descriptor, effective path, embedded engine version or runtime schema fingerprint was obtained. GitHub source cannot close this without an attestation from the actual API host/process.

### DEC-008 — PostgreSQL/SQLite parity

**OPEN.** The inspected package manifest shows SQLite but no PostgreSQL driver. No executable parity harness, pinned dual-engine test workflow, or test result was established by this source review. A new disposable harness must be built and run before any parity pass can be claimed.

### Cross-platform contracts

**CRITICAL — NOT RECONCILED.**
- Mobile source is Expo/React Native and has a Metro web target.
- The reviewed API client contract is inquiry-centric and lacks the canonical multi-tenant transaction context.
- The backend authorization source is single-enterprise.
- No desktop application source/target was established from the reviewed paths.
- A Metro web build target is not evidence of an independently governed Web application or Desktop application.

## 4. Required corrective work — design and branch only

1. Map all actual API routes and DB constructors to the canonical entities and DEC-001–005 authority model.
2. Identify whether the existing single-enterprise path is to be superseded, isolated as a legacy MVP path, or removed; do not silently reinterpret it as multi-tenant.
3. Design the PostgreSQL-authoritative API boundary and its non-bypass runtime role before writing migration or deployment code.
4. Define one canonical API contract for Web, Mobile and Desktop, including user, tenant, membership, participant, transaction, site-link, action, lifecycle and idempotency semantics.
5. Inventory whether Web and Desktop are separate repositories/apps; do not claim parity from the Mobile repository alone.
6. Materialize DEC-006 RLS and DEC-008 parity tests only in disposable CI resources after test code and workflow safety review.
7. Obtain actual-host DEC-007 provenance independently.

## 5. Decision and restrictions

- This inventory is a source review, not a runtime or database audit.
- No tests were run in this step.
- No Actions run was started or re-run.
- No database, migration, DDL, API process, deployment, staging or production resource was accessed or changed.
- No source implementation was modified.
- The identified architecture divergence is **CRITICAL / OPEN** until an explicit reconciliation decision and evidence-backed implementation review close it.
- DEC-006, DEC-007, DEC-008 and schema freeze remain **OPEN / NOT READY**.

**Recommendation:** Do not proceed to schema freeze. First reconcile the existing single-enterprise SQLite API with the approved multi-tenant PostgreSQL-authoritative domain model and establish whether Web and Desktop implementations exist in separate repositories.
