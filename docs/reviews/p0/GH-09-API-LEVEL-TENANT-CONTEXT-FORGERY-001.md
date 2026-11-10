# GH-09 — API-Level Tenant Context Forgery and Pool Isolation

**Status:** TEST HARNESS IMPLEMENTED — PRODUCTION INTEGRATION NOT EVIDENCED — RLS-016 BLOCKED  
**Date:** 2026-11-10  
**Branch:** `review/p0-domain-schema-readonly-2026-11-10`  
**Scope:** Disposable PostgreSQL fixture and test-only HTTP adapter. No staging/production database or application runtime is modified.

## 1. Baseline finding

The repository API runtime currently uses `better-sqlite3` and the enterprise authorization module accepts a SQLite-compatible database. No PostgreSQL pool, PostgreSQL transaction context middleware, or PostgreSQL-backed production API route is present in the inspected runtime. Therefore GH-09 cannot honestly claim that production API context derivation has been implemented.

The new HTTP adapter is an executable security-contract harness. It demonstrates and tests the required trust-boundary behavior against the disposable PostgreSQL fixture. It is not wired into `server/index.mjs` and must not be treated as production authorization evidence.

## 2. Test contract implemented

`tests/p0-db-gates/api-context-test.mjs` starts a test-only Express HTTP server and uses:
- A fixed test bearer-token identity map; no production identity provider or credentials.
- A control-plane membership lookup through the disposable fixture's admin connection.
- A separate `app_api` pool with `max: 1`, `NOSUPERUSER`, and `NOBYPASSRLS`.
- Transaction-local `set_config(..., true)` for `app.tenant_id` and `app.user_id`.
- Commit/rollback and connection release in a `finally` path.

The request tenant header is only a consistency selector. A mismatched selector is rejected. Request body tenant fields are never used to establish database context. The selected tenant is derived from the authenticated test identity's active membership.

**Important:** The admin connection and static identity map are disposable-fixture conveniences only. They are not an approved production design. A production implementation must use a narrowly privileged membership/context resolver and must never expose database credentials or context-setting capability to clients.

## 3. Negative-access and isolation cases

| Case | Expected behavior |
|---|---|
| API-001 unauthenticated request | HTTP 401 |
| API-002 forged tenant header | HTTP 403 |
| API-003 body contains another tenant | Context remains membership-derived; only own tenant rows visible |
| API-004 revoked membership | HTTP 403 |
| API-005 same pooled backend connection reused | Transaction-local tenant and user context are NULL; no audit rows visible |

The RLS runner consumes `artifacts/api-context.json`. It only reports RLS-016 PASS if all five API cases pass and the API evidence explicitly reports RLS-016 PASS. The harness intentionally reports RLS-016 BLOCKED while it remains a test-only adapter, so a successful adapter test cannot silently promote the production decision.

## 4. Workflow integration

`.github/workflows/p0-disposable-db-gates.yml` now runs the API context suite after fixture initialization and before the RLS suite. It preserves `api-context.json`, records `api_exit`, hashes the new test script in the evidence manifest, uploads the artifact even on failure, and includes the API suite in the fail-closed final gate.

## 5. Remaining acceptance criteria to clear RLS-016

1. Implement the PostgreSQL-backed API route/context middleware in the authoritative production backend after the database architecture and migration plan are approved.
2. Authenticate using the real verified identity provider; never trust a client-supplied user or tenant context.
3. Resolve active membership through a least-privilege backend-only resolver. Do not use a superuser membership lookup in production.
4. Derive tenant and user context server-side and set it transaction-locally on the exact pooled connection used by protected queries.
5. Guarantee rollback and connection release on all error paths; verify reset on a reused connection and under concurrent requests.
6. Add negative tests for forged header, body, query, and alternate context selectors; cross-tenant reads/writes; revoked membership; unauthenticated access; and pool contamination.
7. Run those tests against the actual production API composition with the disposable PostgreSQL service, then attach same-SHA Actions evidence.

Until those criteria are met, **RLS-016 remains BLOCKED, DEC-006 remains OPEN, and schema freeze remains NOT APPROVED**.
