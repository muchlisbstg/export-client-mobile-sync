# Staging PostgreSQL Migration Plan

## Scope and guardrails

- Target: Supabase project `export-client-staging` (`utvxuzmtevnmrcpxfpaa`, PostgreSQL 17, `ap-south-1`).
- Source system: SQLite is created by `server/index.mjs`; physical runtime host and resolved `API_DB_PATH` are not verified. No VPS or dedicated backend host has been identified or hired.
- Initial staging data strategy: **both** (synthetic test fixtures plus a controlled, reviewed import from a verified SQLite source).
- Production is read-only for this work. Do not run schema changes, writes, exports that alter source state, cutover, or deployment against production.
- Do not merge this branch, change `main`, or deploy production. User performs review and merge manually.
- Do not copy personal/customer data into staging until a data classification, minimization, masking, and explicit staging-import approval are complete.

## Evidence snapshot (2026-11-03)

- Repository: `muchlisbstg/export-client-mobile-sync`; preparation branch is based on `0358bfa664e26ad3ff872c805da606651e99330e`.
- `package.json` includes `better-sqlite3`, `express` 5, and `dev:api = node server/index.mjs`; no `engines` field is declared.
- `server/index.mjs` creates SQLite at `options.dbPath ?? process.env.API_DB_PATH ?? server/data/api.sqlite`; enables WAL and foreign keys.
- The API defaults to `127.0.0.1:4001` and reads `API_PORT`, not the conventional hosting `PORT`. A public web service requires a deliberate bind/port adjustment (e.g. host `0.0.0.0` and honor the platform-provided `PORT`).
- The API startup creates catalog/inquiry/sync tables in SQLite. The tenant and supply-chain schema is applied separately by `scripts/migrate-tenant-isolation.mjs` / `scripts/migrate-supply-chain.mjs`; it is not proof that a deployed SQLite file has those migrations.
- `server/authorization.mjs`, `server/supply-chain.mjs`, and `server/supply-chain-routes.mjs` call better-sqlite3-specific methods (`prepare`, `transaction`, `pragma`, SQLite metadata). A PostgreSQL driver cannot be substituted without a repository/service refactor.
- The Vercel project `export-client-mobile-sync` is the frontend deployment. Its environment inventory did not identify a backend service or `API_DB_PATH`; this does not prove where a local SQLite file may exist.
- No dedicated VPS/backend host is currently known. The only known database project is Supabase staging.
- Supabase staging project is `ACTIVE_HEALTHY`, PostgreSQL 17.11. Read-only table inventory for `public` and `private` returned no application tables; migration history is empty.
- A read-only SQL probe connected as `postgres`. This is evidence about the connector session, not the intended least-privilege runtime role.
- No staging schema DDL, application data import, or deployment has been executed.

## Hosting decision for staging

**Recommended: Render Free Web Service for the first Node.js staging API**, with Supabase PostgreSQL remaining the only staging database.

Rationale and trade-offs:
- Render supports a conventional Node.js web service, matching the current Express server model with less refactoring than a serverless-only host.
- Free web services spin down after 15 minutes without inbound traffic and take about a minute to wake. They have ephemeral filesystems; local SQLite files are lost on restart, redeploy, or spin-down.
- Free web services do not provide SSH/shell access, persistent disks, or always-on behavior. Therefore Render Free is suitable only after the API uses Supabase PostgreSQL; it is not suitable as the authoritative home for SQLite.
- Render's free Postgres expires after 30 days and has no backups. Do not create it for this project; use the already-provisioned Supabase staging PostgreSQL.
- Render may suspend a Free service if it initiates unusually high outbound traffic, including external database/API traffic. Monitor usage and verify this during staging tests.
- Vercel Functions are a viable alternative only after adapting the Express API to request-scoped serverless handlers and removing assumptions about a long-running process/timer. Current peer-sync timers and the conventional HTTP listener make Render the lower-change initial option.

Before creating the Render service:
1. Complete PostgreSQL repository adapter and remove runtime dependence on local SQLite for the staging service.
2. Change the server listener to honor the platform `PORT` and bind externally (for example, `0.0.0.0`) without changing local-development defaults unexpectedly.
3. Add health/readiness behavior and ensure sync workers do not depend on an in-process timer that can be lost during sleep/restart; use durable outbox processing with restart-safe scheduling.
4. Connect the GitHub repository to a new Render service using the Render dashboard. No Render account/service is currently connected or created by this task.

Source: [Render free service limitations](https://render.com/docs/free), [Vercel Node.js Function limitations](https://vercel.com/docs/functions/limitations).

## PostgreSQL connection contract

- Supabase staging project reference: `utvxuzmtevnmrcpxfpaa`; project URL: `https://utvxuzmtevnmrcpxfpaa.supabase.co`; region `ap-south-1`; PostgreSQL 17.11.
- Store the Supabase connection string as a server-side secret named `DATABASE_URL` in the hosting provider. Obtain the exact URI from Supabase Dashboard → Connect; choose the Session Pooler connection if the selected host's IPv4/network compatibility requires it. Do not synthesize the pooler hostname or paste the URI/password into chat or source control.
- Use a dedicated least-privilege runtime database role, not `postgres` and not the Supabase `service_role` API key.
- Keep Supabase Auth URL and publishable/anon key separate from the database connection URI. Server-only secrets must never be prefixed with `EXPO_PUBLIC_` or embedded in the mobile/web bundle.
- Expected staging environment contract (names only; values set in the hosting dashboard): `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SINGLE_ENTERPRISE_ID`, `WEB_ORIGINS`, and any approved peer-sync secrets. `API_HOST` / `PORT` handling must be updated before hosting.
- Connection preparation is documentation-only. No database password, API key, or runtime role credential was created, retrieved, or changed.

## Source discovery gate (must pass before extraction)

The repository default `server/data/api.sqlite` is only a fallback path, not proof that a physical database exists or is authoritative. First establish where the API is actually run (Termux/local workstation, CI, or hosted runtime). On that exact machine, using an authorized read-only shell/session:

1. Identify the process/service, deployment revision, working directory, and service manager.
2. Inspect the effective environment **without printing secret values**; record whether `API_DB_PATH` is set and resolve the final absolute path.
3. Verify the file exists and record file size, modification time, owner, permissions, and filesystem/mount characteristics. Do not upload the file or copy it yet.
4. Inspect SQLite metadata read-only: `PRAGMA database_list`, `PRAGMA journal_mode`, `PRAGMA foreign_keys`, `PRAGMA integrity_check`, `PRAGMA foreign_key_check`, table names, schema DDL, row counts, and min/max timestamps where available.
5. Account for WAL state. Use SQLite's online backup API or a coordinated filesystem-consistent snapshot only after the source owner approves the read operation; never copy only the main database file while a live WAL database is changing.
6. Produce a source inventory and SHA-256 manifest for the approved snapshot. Keep the source untouched.
7. Classify personal, customer, commercial, and evidence data. Define masking/minimization before any staging import. Staging receives synthetic fixtures plus only the specifically approved, sanitized source subset.

If the host or effective database path cannot be verified, stop and report the missing evidence; do not infer a path from the repository default.

## Migration architecture

- A draft schema baseline is in [`postgres-schema-draft.sql`](./postgres-schema-draft.sql). It was authored from repository DDL sources, not from a live SQLite snapshot, and has **not** been applied or PostgreSQL-executed.
- Treat the draft as a review artifact, not a release migration. Reconcile it against the live SQLite `sqlite_master` / PRAGMA inventory before generating the final versioned migration.
- Introduce a PostgreSQL repository adapter behind the existing API/service contract. Keep the SQLite adapter available during the transition; avoid a broad rewrite in the first migration PR.
- Port authorization and supply-chain persistence in isolated follow-up slices. Existing authorization and supply-chain modules directly call SQLite APIs, so changing only the API bootstrap is insufficient.
- Preserve identifiers as text initially where the existing domain uses slugs or mixed formats. Avoid bulk UUID conversion.
- Preserve inventory quantities as integer milli-units (`bigint`), never floating-point stock.
- Use `numeric` for financial values where exact decimal semantics are required; validate all legacy REAL fields before mapping.
- Convert validated JSON text to `jsonb`; retain original text or quarantine malformed rows for explicit remediation.
- Preserve timestamps with an explicit UTC interpretation; do not silently reinterpret timezone-naive values.
- Preserve unique constraints, foreign keys, idempotency keys, transactional boundaries, audit history, and both outbox flows (`sync_outbox`, `tenant_sync_outbox`).
- Keep API response/request contracts stable for Expo Web and mobile clients.
- The draft places tables in non-exposed `app_private` and enables/forces RLS without permissive policies. This intentionally denies ordinary runtime access until reviewed enterprise/site policies and grants are added. Do not weaken this deny-by-default posture just to make tests pass.
- Do not apply DDL to staging until the schema draft, security model, and runtime role have been reviewed and explicitly approved.

## Initial logical inventory to reconcile against live SQLite

Expected domains from the current codebase (not a substitute for inspecting live SQLite DDL):

- Catalog and inquiry: `products`, `inquiries`.
- Peer sync: `sync_outbox`, `sync_conflicts`, `tenant_sync_outbox`.
- Enterprise and access: `tenants`, `tenant_memberships`, `enterprise_role_assignments`, `enterprise_role_audit`, `commercial_transactions`.
- Supply chain: `supply_sites`, `supply_lots`, `lot_genealogy`, `inventory_movements`, `inventory_entries`, `processing_losses`, `quality_inspections`, `handovers`, `supply_evidence`, `supply_site_assignments`, `supply_audit_events`.

Reconcile every table, column, index, trigger, foreign key, default, check constraint, and row count against the actual server database before generating the final PostgreSQL schema. This list is a planning inventory, not a claim that all tables currently exist in the live SQLite file.

## Supabase security model

- Decide explicitly whether business tables belong in an unexposed schema or an exposed schema. Do not assume newly created `public` tables are automatically reachable through the Data API.
- Enable RLS on every exposed business table. Policies must scope by trusted enterprise membership and, where applicable, assigned site.
- Never use user-editable `user_metadata` for authorization. Roles come from trusted server-side membership/assignment records.
- For UPDATE policies, include both `USING` and `WITH CHECK`.
- Default functions to `SECURITY INVOKER`; any required definer function needs a separate threat-model review, non-exposed placement, restricted EXECUTE grants, and advisor verification.
- Do not put service-role keys, database passwords, or privileged credentials in browser/mobile bundles.
- The runtime database role must be least-privilege. Do not use the `postgres` or service-role credential for ordinary application requests.
- Validate transaction-scoped identity context and prove it cannot be spoofed or leaked across pooled connections before relying on it for RLS.

## Data migration and reconciliation

1. Create an approved, consistent SQLite snapshot; retain original unchanged.
2. Export to versioned, checksummed, access-controlled staging files.
3. Load synthetic fixtures first and verify constraints and API behavior.
4. Import the approved sanitized source subset in dependency order inside repeatable transactions.
5. Compare per-table row counts, primary-key sets, checksums for stable fields, FK orphans, nullability, enum/status distributions, and timestamps.
6. Reconcile inventory balances from posted ledger entries and compare to SQLite-derived balances.
7. Reconcile outbox pending/retry/conflict states and ensure idempotent replay does not duplicate records.
8. Record rejected/quarantined rows with reason codes; do not silently drop or coerce them.

## Staging validation gates

- Schema: migrations apply cleanly; expected constraints/indexes; no unexpected public Data API exposure.
- Integrity: no FK orphans; all checks pass; inventory balance and processing-loss reconciliation.
- Security: unauthenticated denial, role matrix, enterprise/site isolation, cross-tenant denial, RLS negative tests, no privileged secrets in client assets.
- API: login/session, catalog, inquiry create, tracking, and stable response contracts.
- Supply chain: intake → QC hold/release → processing/genealogy → stock transfer → dispatch/receipt/discrepancy → evidence and audit.
- Sync: at least two peer nodes; retry/backoff, duplicate replay, conflict handling, and outbox recovery after process restart.
- Resilience: transaction rollback, interrupted import restart, backup/restore rehearsal, and staging recovery.
- Web: browser smoke test, CORS, responsive layout, Web Share/clipboard, console and network errors.
- Performance: query plans and indexes for measured critical paths; no speculative indexing without workload evidence.

## Delivery slices

1. **This branch / preparation:** evidence, source discovery, schema mapping rules, draft SQL, migration runbook, and acceptance gates.
2. **PostgreSQL schema PR:** final versioned DDL after live SQLite inventory review and schema/security review.
3. **Repository adapter PR:** catalog/inquiry and sync persistence, preserving API contract.
4. **Authorization/RLS PR:** trusted role mapping, enterprise/site policy tests, least-privilege runtime role.
5. **Supply-chain PostgreSQL PR:** isolated port of supply-chain persistence and transactional invariants.
6. **Staging import and cutover PR:** only after data approval, repeatable import, reconciliation, rollback plan, and staging-only deployment approval.

## Explicit stop conditions

Stop before any write if source host/path is unverified, snapshot consistency is uncertain, row mapping is ambiguous, PII masking is undefined, RLS negative tests fail, or the intended runtime role requires bypassing RLS. Production remains untouched throughout.
