# Staging PostgreSQL Preparation Plan

## Scope and binding decisions

- Target: Supabase project `export-client-staging` (`utvxuzmtevnmrcpxfpaa`, PostgreSQL 17, `ap-south-1`).
- Staging data policy: **synthetic fixtures only**, and only after the actual source schema has been reconciled and the fixture design reviewed.
- Operational/customer/commercial records must not be exported, copied, sanitized for transfer, or imported into staging under the current authorization.
- Production remains read-only. No production DDL, writes, exports, cutover, or deployment.
- Infrastructure budget is not yet available. Do not provision paid Hostinger VPS, AWS, or other live infrastructure. Use existing GitHub workflows and the already available Supabase staging project where safe.
- User reviews and merges PRs manually. Do not merge, deploy, or apply infrastructure automatically.

## Evidence snapshot (2026-11-03)

- Repository: `muchlisbstg/export-client-mobile-sync`.
- `package.json` includes `better-sqlite3` and `dev:api = node server/index.mjs`.
- `server/index.mjs` resolves the database as `options.dbPath ?? process.env.API_DB_PATH ?? server/data/api.sqlite`, enables WAL, and enables foreign keys.
- The repository's `main` branch contains application bootstrap/schema creation code, but source-code DDL is not a substitute for the physical SQLite schema.
- A prior local Termux audit of `server/data/api.sqlite` reported 21 tables, 10 triggers, 51 total rows, WAL journal mode, `integrity_check=ok`, and an empty `foreign_key_check`. At the time of that audit, the WAL file was 0 bytes and the SHM file was 32 KiB.
- **Source boundary:** the local Termux database audit does not prove that this file is the database used by the currently deployed API service. The physical API runtime host and effective `API_DB_PATH` remain unverified.
- Supabase staging was previously observed as `ACTIVE_HEALTHY`, PostgreSQL 17.11, with no application tables and empty migration history. Re-check immediately before any staging DDL.
- No migration or data import is authorized or recorded as completed.

## Source schema discovery gate

The schema-only baseline must come from an authorized, consistent read of the actual SQLite source selected by the application owner. Before treating any artifact as authoritative:

1. Identify the API process/service, deployment revision, working directory, and service manager.
2. Inspect effective environment variable names without printing secret values; determine whether `API_DB_PATH` is set and resolve the final absolute path.
3. Verify the source file identity and metadata. Do not infer the deployed database path from the repository default or from a local Termux copy.
4. Read SQLite metadata without changing the source: `PRAGMA database_list`, `journal_mode`, `foreign_keys`, `integrity_check`, `foreign_key_check`, table DDL, indexes, triggers, and constraints.
5. Account for WAL consistency. Do not copy only the main database file from a live WAL database.
6. Produce a schema-only artifact named `api-schema-only.sql` plus non-sensitive provenance metadata (source identity, extraction timestamp, SQLite version, schema/user versions, table/trigger/index counts, and SHA-256).
7. Exclude all row contents, sample values, credentials, customer identifiers, and operational records from the artifact and metadata.
8. Reconcile the artifact against the expected application domains and record every mismatch before drafting PostgreSQL DDL.

If the actual API host/path or snapshot consistency cannot be verified, stop. A local database snapshot or source-code DDL must not be represented as the deployed API schema.

## Schema reconciliation requirements

- Reconcile all tables and columns, declared types, nullability, defaults, primary keys, unique constraints, foreign keys, CHECK constraints, indexes, and triggers.
- Account for SQLite-specific behavior such as `AUTOINCREMENT`, affinity, collations, partial indexes, expression indexes, trigger ordering, and timestamp/text conventions.
- Preserve identifiers as text where the domain uses slugs or mixed formats; do not bulk-convert identifiers to UUID.
- Preserve inventory quantities as integer milli-units (`bigint`) in PostgreSQL; never use floating-point stock.
- Use `numeric` for financial values where exact decimal semantics are required.
- Validate JSON text before mapping to `jsonb`; document malformed or ambiguous schema/data semantics without exporting their values.
- Preserve transactional boundaries, idempotency keys, audit history, and outbox semantics.
- Keep API request/response contracts stable for Expo Web and mobile clients.
- The logical table inventory in application code is a discovery aid only; it is not evidence that each table exists in the physical SQLite database.

## Supabase security model — design only until approval

- Decide whether business tables belong in an unexposed schema or an exposed schema.
- Enable RLS on every exposed business table.
- Scope policies by trusted enterprise membership and assigned site where applicable.
- Never use user-editable `user_metadata` for authorization.
- For UPDATE policies, include both `USING` and `WITH CHECK`.
- Default functions to `SECURITY INVOKER`; review any required definer function separately.
- Do not place service-role keys, database passwords, or privileged credentials in browser/mobile bundles.
- Use a least-privilege runtime role; do not use the `postgres` or service-role credential for ordinary application requests.
- Validate identity context and connection-pool isolation before relying on it for RLS.
- No staging DDL is applied until the schema, grants, RLS policies, and negative tests are reviewed and explicitly approved.

## Synthetic fixture policy

1. Complete schema-only extraction and reconciliation first.
2. Design fixtures from the reconciled schema; use wholly fabricated identities, organizations, products, lots, quantities, documents, and timestamps.
3. Do not derive fixture values from operational records or use production rows as templates.
4. Keep fixtures deterministic, minimal, and clearly labeled as synthetic.
5. Test constraints, transaction boundaries, role isolation, inventory invariants, outbox idempotency, and API contracts.
6. Record fixture version and test outcomes; never include secrets or real personal/commercial data.

## Staging validation gates

- Schema: versioned migration matches the approved schema baseline; expected constraints/indexes/triggers are tested.
- Integrity: no FK orphans; all checks pass; inventory balance and processing-loss invariants hold for synthetic fixtures.
- Security: unauthenticated denial, role matrix, enterprise/site isolation, cross-tenant denial, RLS negative tests, and no privileged secrets in client assets.
- API: login/session, catalog, synthetic inquiry creation, tracking, and stable response contracts.
- Supply chain: intake → QC hold/release → processing/genealogy → stock transfer → dispatch/receipt/discrepancy → evidence and audit, all using synthetic fixtures.
- Sync: at least two peer nodes; retry/backoff, duplicate replay, conflict handling, and outbox recovery after process restart.
- Resilience: transaction rollback and backup/restore rehearsal using staging-only synthetic data.
- Web/mobile: browser smoke tests, CORS, responsive layout, console/network errors, and Android/iOS build evidence.
- Performance: query plans and indexes for measured critical paths; no speculative indexing.

## Delivery slices

1. **Schema baseline PR:** only `api-schema-only.sql` and non-sensitive provenance metadata; no database file or row data.
2. **Reconciliation report:** table/column/index/trigger/constraint comparison and unresolved differences.
3. **PostgreSQL schema PR:** versioned DDL only after schema reconciliation and security review.
4. **Repository adapter PRs:** isolated catalog/inquiry/sync, authorization, and supply-chain slices while preserving API contracts.
5. **Synthetic staging validation:** apply only to the dedicated Supabase staging project after explicit approval; no operational import.
6. **Live infrastructure:** Hostinger VPS selection and provisioning remain deferred until a budget is approved. AWS draft infrastructure is not the selected provider.

## Explicit stop conditions

Stop before any write if the actual source host/path is unverified, snapshot consistency is uncertain, schema mapping is ambiguous, RLS negative tests fail, or the intended runtime role requires bypassing RLS. Never export or import operational data under this plan. Production remains untouched throughout.
