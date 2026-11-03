# Staging PostgreSQL Migration Plan

## Scope and guardrails

- Target: Supabase project `export-client-staging` (`utvxuzmtevnmrcpxfpaa`, PostgreSQL 17, `ap-south-1`).
- Source system: server-hosted SQLite used by `server/index.mjs`; physical runtime host and resolved `API_DB_PATH` are not yet verified.
- Initial staging data strategy: **both** (synthetic test fixtures plus a controlled, reviewed import from the server SQLite source).
- Production is read-only for this work. Do not run schema changes, writes, exports that alter source state, cutover, or deployment against production.
- Do not merge this branch, change `main`, or deploy production. User performs review and merge manually.
- Do not copy personal/customer data into staging until a data classification, minimization, masking, and explicit staging-import approval are complete.

## Evidence snapshot (2026-11-03)

- Repository: `muchlisbstg/export-client-mobile-sync`; base commit: `0358bfa664e26ad3ff872c805da606651e99330e`.
- `package.json` includes `better-sqlite3` and `dev:api = node server/index.mjs`.
- `server/index.mjs` creates SQLite at `options.dbPath ?? process.env.API_DB_PATH ?? server/data/api.sqlite`; enables WAL and foreign keys.
- `server/authorization.mjs` requires a better-sqlite3-compatible handle. Current auth/enterprise membership and supply-chain routes therefore depend on SQLite-shaped database APIs.
- The Vercel project `export-client-mobile-sync` has no environment variables returned by the environment inventory, and its project metadata identifies a frontend deployment. This does not identify the host running the Node API or prove where its SQLite file resides.
- Supabase staging project is `ACTIVE_HEALTHY`, PostgreSQL 17.11. No application tables were returned for `public`/ `private`; migration history is empty.
- A read-only SQL probe connected as `postgres`. This is evidence about the staging connector session, not the intended least-privilege runtime role.
- No migration or data import has been executed.

## Source discovery gate (must pass before extraction)

On the actual API host, using an authorized read-only shell/session:

1. Identify the process/service, deployment revision, working directory, and service manager.
2. Inspect the effective environment **without printing secret values**; record whether `API_DB_PATH` is set and resolve the final absolute path.
3. Verify the file exists and record file size, modification time, owner, permissions, and filesystem/mount characteristics. Do not upload the file or copy it yet.
4. Inspect SQLite metadata read-only: `PRAGMA database_list`, `PRAGMA journal_mode`, `PRAGMA foreign_keys`, `PRAGMA integrity_check`, `PRAGMA foreign_key_check`, table names, schema DDL, row counts, and min/max timestamps where available.
5. Account for WAL state. Use SQLite's online backup API or a coordinated filesystem-consistent snapshot only after the source owner approves the read operation; never copy only the main database file while a live WAL database is changing.
6. Produce a source inventory and SHA-256 manifest for the approved snapshot. Keep the source untouched.
7. Classify personal, customer, commercial, and evidence data. Define masking/minimization before any staging import. Staging receives synthetic fixtures plus only the specifically approved, sanitized source subset.

If the API host or effective database path cannot be verified, stop and report the missing evidence; do not infer a path from the repository default.

## Migration architecture

- Introduce a PostgreSQL repository adapter behind the existing API/service contract. Keep the SQLite adapter available during the transition; avoid a broad rewrite in the first migration PR.
- Port authorization and supply-chain persistence in isolated follow-up slices. Existing authorization and supply-chain modules directly call SQLite APIs, so changing only the API bootstrap is insufficient.
- Preserve identifiers as text initially where the existing domain uses slugs or mixed formats. Avoid bulk UUID conversion.
- Preserve inventory quantities as integer milli-units (`bigint`), never floating-point stock.
- Use `numeric` for financial values where exact decimal semantics are required; validate all legacy REAL fields before mapping.
- Convert validated JSON text to `jsonb`; retain original text or quarantine malformed rows for explicit remediation.
- Preserve timestamps with an explicit UTC interpretation; do not silently reinterpret timezone-naive values.
- Preserve unique constraints, foreign keys, idempotency keys, transactional boundaries, audit history, and both outbox flows (`sync_outbox`, `tenant_sync_outbox`).
- Keep API response/request contracts stable for Expo Web and mobile clients.
- Use versioned SQL migrations committed in this branch. Do not apply DDL to staging until the migration SQL and security model have been reviewed and explicitly approved.

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

1. **This branch / preparation:** document evidence, source discovery, schema mapping rules, migration runbook, and acceptance gates.
2. **PostgreSQL schema PR:** versioned DDL and constraints after live SQLite inventory review.
3. **Repository adapter PR:** catalog/inquiry and sync persistence, preserving API contract.
4. **Authorization/RLS PR:** trusted role mapping, enterprise/site policy tests, least-privilege runtime role.
5. **Supply-chain PostgreSQL PR:** isolated port of supply-chain persistence and transactional invariants.
6. **Staging import and cutover PR:** only after data approval, repeatable import, reconciliation, rollback plan, and staging-only deployment approval.

## Explicit stop conditions

Stop before any write if source host/path is unverified, snapshot consistency is uncertain, row mapping is ambiguous, PII masking is undefined, RLS negative tests fail, or the intended runtime role requires bypassing RLS. Production remains untouched throughout.
