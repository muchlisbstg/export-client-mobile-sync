# GH-05-DISPOSABLE-POSTGRESQL-RLS-IMPLEMENTATION-001

**Status:** EXECUTABLE TEST FIXTURE ADDED — REVIEW AND RUN REQUIRED
**Date:** 2026-11-10
**Scope:** Disposable PostgreSQL only; no production/staging DB.
**Files:** `tests/p0-db-gates/postgres-rls.sql`, `tests/p0-db-gates/rls-test.mjs`

## 1. Safety boundary

The SQL creates a test-only `app_api` role with NOSUPERUSER and NOBYPASSRLS and a minimal disposable schema. It is designed for an ephemeral GitHub Actions PostgreSQL service. It must never be applied to an existing database. The API role password is a fixed disposable test credential and must never be reused.

## 2. Implemented scope

The test schema exercises tenant, membership, transaction, participant, site, exact site-link, assignment, assignment-action, permission catalog and audit-event row security. Tenant-owned tables have RLS enabled and FORCE RLS. The test client connects as `app_api`, not the schema owner. RLS-001–018 are enumerated in the runner.

The server context is represented by transaction-local `app.tenant_id` and `app.user_id` settings. This is a test of the database boundary under a trusted backend-established context. It is **not** proof that arbitrary end-user SQL can safely choose those settings; direct database access must remain unavailable to end users. The API must derive these settings only after authenticating the user and resolving active membership. Client-supplied tenant headers are selectors, never trusted context.

## 3. Important non-pass

RLS-016 is deliberately marked BLOCKED in the runner because it is an HTTP/API trust-boundary test, not a property that can be proven by a raw SQL role session. It requires an API integration test that submits a forged tenant selector and verifies that the server ignores/rejects it after resolving the authenticated membership. The suite exits non-zero while this case remains blocked.

RLS-003 verifies a forged tenant-row write is rejected by RLS. RLS-004 checks revoked membership cannot satisfy the active membership read predicate. RLS-015 checks transaction-local context does not leak to a subsequent pooled transaction. RLS-017 checks ordinary API role cannot update/delete audit history.

## 4. Known limitations before DEC-006 closure

- This is a focused executable fixture, not yet a complete production schema policy migration.
- Table inventory must be reconciled against all physical PostgreSQL tables, views, partitions and functions.
- The transaction policy currently relies on the active participant predicate; lifecycle and approval predicates require complete domain integration.
- Action authorization requires the API to check active action grants; the fixture covers visibility through assignment parent scope but does not replace endpoint-level policy tests.
- View/function/partition ownership and SECURITY DEFINER review remains required.
- The API's actual pool initialization, context-setting code and context reset must be tested in the real service.
- RLS-016 API-level test is intentionally outstanding.

## 5. Acceptance

DEC-006 cannot pass until all 18 cases are executable and pass, the role/ownership/grant inventory is reviewed, the complete physical schema is covered, and the API integration proves trusted context derivation. This test fixture is not an authorization implementation for the live service.
