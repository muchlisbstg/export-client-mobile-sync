# Backend staging host and PostgreSQL connection plan

## Decision

Recommend Render Web Service for the Node.js staging API, separate from the existing Vercel Expo Web frontend.

Why:
- Render natively supports Node.js services.
- The current API is a long-running Express server (node server/index.mjs) with HTTP endpoints and in-process peer-sync retry scheduling. A Web Service is a closer runtime fit than converting the app to short-lived serverless functions.
- Render Free is acceptable only for short-lived functional smoke tests. It spins down after 15 minutes idle, loses local filesystem changes on spin-down/redeploy/restart, has no persistent disk, and has no SSH shell access. It is therefore not a valid home for SQLite or durable background sync.
- For continuous staging and peer-sync tests, use a paid always-on Web Service. Do not attach or migrate a SQLite file to Render; PostgreSQL becomes the persistent store.

Official references:
- https://render.com/docs/faq
- https://render.com/docs/free
- https://render.com/pricing

No Render service has been created and no deployment has been initiated. The user must create/connect the Render account and explicitly approve any paid compute.

## Runtime compatibility findings

Repository evidence on main:
- Root package.json defines dev:api: node server/index.mjs.
- Runtime dependencies include Express 5 and better-sqlite3.
- server/index.mjs loads .env.api, binds to API_PORT (default 4001) and API_HOST (default 127.0.0.1), and resolves SQLite path from API_DB_PATH or server/data/api.sqlite.
- It enables SQLite WAL and foreign keys at startup.
- The API has periodic in-process outbox delivery and peer sync. A sleeping/free instance cannot provide reliable continuous worker semantics.
- Existing authorization and supply-chain services call better-sqlite3 APIs directly; setting only a PostgreSQL URL will not migrate persistence. A PostgreSQL repository adapter and service refactor are required.
- The existing Vercel project is the Expo Web frontend; no evidence establishes that it hosts the Node API.

## Staging service configuration (template only)

Suggested Render Web Service:
- Repository: muchlisbstg/export-client-mobile-sync
- Branch: a dedicated backend staging branch after implementation is reviewed
- Root directory: repository root
- Build command: npm ci
- Start command: npm run dev:api (rename to start:api before service setup if preferred)
- Health check path: /health
- Region: Singapore if available and compatible with the Supabase project region; verify actual Render region availability before creation.

Environment variables to configure through Render's secret manager, never commit:
- NODE_ENV=staging
- API_HOST=0.0.0.0
- API_PORT supplied by Render's PORT contract (implementation must read PORT before deployment)
- SUPABASE_URL=https://utvxuzmtevnmrcpxfpaa.supabase.co
- SUPABASE_ANON_KEY only if the existing auth verifier requires it; do not place service-role credentials in clients
- DATABASE_URL from the Supabase staging connection pooler, stored as a secret
- WEB_ORIGINS restricted to the exact Vercel Preview origin(s)
- SINGLE_ENTERPRISE_ID and SYNC_NODE_ID only after staging fixtures and peer topology are defined
- SYNC_SHARED_SECRET only for isolated staging peer tests; generate unique staging-only secrets

Do not configure API_DB_PATH on Render after the PostgreSQL adapter is active. Do not set DATABASE_URL until the code has a working PostgreSQL adapter and a least-privilege staging DB role.

## PostgreSQL connection approach

1. In Supabase staging Dashboard, create a dedicated application role with only required schema/table privileges. Do not use postgres or service_role for normal API traffic.
2. Obtain the staging connection string from Supabase Database settings / Connect. Prefer the Supabase pooler connection string appropriate for the Node pg client and selected pooler mode.
3. Store it only in Render secret environment variables. Never paste it into chat, GitHub, source code, Expo configuration, or browser assets.
4. Use TLS and a bounded connection pool. Use transaction-scoped identity context only after proving it is safe with pooled connections.
5. Run a staging-only SELECT current_database(), current_user, version() health probe after credentials are installed. Confirm the effective role is the dedicated runtime role, not postgres.
6. Production URL/password must never be present in the staging service.

Connection setup is not complete: no Render service exists, no runtime role/credential has been created, and the current repository does not yet have a PostgreSQL adapter.

## SQLite physical audit gate

No physical SQLite database file or runtime host has been located. The default path in source code is only a fallback, not evidence that a file exists there. Render cannot be used to recover a database that was never deployed there.

Before any import:
- Locate the actual database on the user's Termux/device or other machine.
- Confirm the path and inspect the main database plus -wal and -shm siblings.
- Open read-only and collect PRAGMA database_list, journal_mode, foreign_keys, integrity_check, foreign_key_check, sqlite_master DDL, row counts and timestamp ranges.
- For a live WAL database, use SQLite online backup API or a consistent snapshot. Never copy only the .sqlite main file while WAL is active.
- Produce SHA-256 checksums and a manifest. Do not upload source data until classified and approved.

## Migration SQL status

Do not apply a migration yet. The runtime source contains DDL for catalog/inquiry/sync and supply-chain tables, while the tenant/authorization schema and the live SQLite database must be reconciled before a complete migration can be declared authoritative. The reference file docs/supply-chain-schema.sql is not authoritative: its numeric fields and columns differ from the actual server/supply-chain.mjs runtime DDL.

Next schema work must use:
1. the complete DDL from the current runtime source (including tenant/role bootstrap and triggers),
2. the physical SQLite sqlite_master output from the actual source file,
3. reconciled constraints, indexes, triggers, and row counts.

## Staging test data

- First load deterministic synthetic fixtures only.
- Include at least two synthetic enterprises/sites, users with buyer/seller/supplier/warehouse/QC/auditor roles, catalog and inquiry records, supply lots, genealogy, posted and draft inventory movements, inspections, handovers, evidence metadata, and sync outbox states.
- Verify tenant/site isolation, negative stock prevention, immutable posted movements, idempotent replay, conflict capture, retry/backoff, and restart recovery.
- Only after data classification and explicit approval, import a minimized sanitized subset from a consistent SQLite snapshot.
- Reconcile counts, primary keys, foreign keys, checksums, inventory balances, timestamps, and outbox states. Quarantine mismatches; never silently discard rows.

## Safety boundary

This document is a staging plan only. It does not create infrastructure, set secrets, apply SQL, access or export production data, deploy, merge, or perform a cutover.