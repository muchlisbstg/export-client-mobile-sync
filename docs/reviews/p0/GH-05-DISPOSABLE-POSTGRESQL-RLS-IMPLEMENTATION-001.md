# GH-05-DISPOSABLE-POSTGRESQL-RLS-IMPLEMENTATION-001

**Status:** DISPOSABLE RLS FIXTURE EXECUTED — 34/34 PASS; PRODUCTION SECURITY SIGN-OFF OPEN  
**Date:** 2026-11-10  
**Branch:** `review/p0-domain-schema-readonly-2026-11-10`  
**Evidence:** [GitHub Actions run 42800478587](https://github.com/muchlisbstg/export-client-mobile-sync/actions/runs/42800478587)  
**Commit:** `55b91afa98bea46a0258db6b4ef9f7819d4c6cda`

## 1. Safety boundary

The SQL creates a test-only `app_api` role and a minimal disposable schema for an ephemeral GitHub Actions PostgreSQL service. It must never be applied to an existing database. No staging/production database is part of this evidence.

## 2. Implemented and executed scope

The fixture exercises tenant, membership, transaction, participant, site, exact site-link, assignment, assignment-action, permission catalog and audit-event row security. Tenant-owned tables have RLS enabled and FORCE RLS. The test client connects as `app_api`, not the schema owner.

- PostgreSQL 16.10.
- Fixture initialization exit code 0.
- 34 RLS tests passed; 0 failed.
- `app_api` is NOSUPERUSER, NOBYPASSRLS and NOCREATEROLE.
- `app_api` has SELECT-only permission on `tenant_memberships`; membership lifecycle writes require a separately authorized service boundary.
- Assignment-action table is SELECT-only for ordinary app_api.
- Audit UPDATE/DELETE are denied.

## 3. Self-enrollment finding

An earlier fixture grant allowed app_api to INSERT membership rows under a policy whose WITH CHECK matched the session user. This allowed a potential self-enrollment attempt. The grant was tightened to SELECT-only, and RLS-033–035 now prove that ordinary app_api cannot self-enroll, reactivate its revoked membership, or delete/revoke a membership. All passed in run 42800478587.

## 4. Context provenance limitation

The server context in this fixture is represented by transaction-local `app.tenant_id` and `app.user_id` settings. This is a test of RLS behavior under a trusted backend-established context. A SQL-capable app_api session can still call set_config() and choose those values. Pool reset prevents accidental leakage, not deliberate arbitrary-SQL forgery.

GH-09 is tested separately through a disposable HTTP adapter and the repository's `createSupabaseAuth` middleware, with a mocked identity-provider response. It reports 13 PASS, 0 FAIL, but it is not the production PostgreSQL API composition and does not validate a live Supabase JWT. Therefore RLS-016 / DEC-006 production identity provenance remains BLOCKED.

## 5. Acceptance and remaining work

**GH-05 disposable RLS fixture: PASS.**  
**Overall P0 security approval / schema freeze: NOT APPROVED.**

Before DEC-006 closure:
- reconcile all real PostgreSQL tables, views, partitions, functions, owners and grants;
- prove production API identity and membership resolution;
- test actual production pool context establishment/reset, including multi-connection concurrency and cancellation;
- independently review SECURITY DEFINER and bypass paths;
- reconcile all canonical schema and API acceptance criteria.

No migration or production/staging mutation is authorized by this test result.
