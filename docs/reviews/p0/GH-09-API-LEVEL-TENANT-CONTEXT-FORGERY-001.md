# GH-09 — API Identity Provenance, POOL-01 and SEC-02

**Status:** DISPOSABLE CONTRACT TESTS PASS — PRODUCTION API CONTEXT INTEGRATION BLOCKED  
**Date:** 2026-11-10  
**Branch:** `review/p0-domain-schema-readonly-2026-11-10`

## Evidence

- Workflow: [GH-09 run 42778888308](https://github.com/muchlisbstg/export-client-mobile-sync/actions/runs/42778888308)
- Tested SHA: `31bcb316d8346c6e6c665d5817aab307d0c98bc3`
- PostgreSQL: 16.10
- Result: **13 PASS, 0 FAIL; RLS-016 BLOCKED**
- Artifact ID: `13744653963`
- Artifact SHA-256: `73ecb9de622e47a9a1836eb6707eefc8dc1b8784b32459f3f44a4cc68856438a`
- API harness SHA-256: `4ec74095eaade2bb50f34e36db1afe9d289251df308ea3fffab9988742df2f7e`

## Executed test contract

The harness imports and invokes the repository's actual `createSupabaseAuth` middleware from `server/auth.mjs`, including `authenticate` and `requireAdmin`. The identity-provider fetcher is mocked and returns a fixed synthetic token-to-user mapping. It deliberately includes user-editable `user_metadata.role=admin`; the middleware does not treat that metadata as an admin grant.

| Area | Tests | Result |
|---|---|---|
| Authentication and membership-derived tenant context | API-001–004 | 4 PASS |
| Forged identity, tenant and role inputs | SEC-02-001–004 | 4 PASS |
| Context cleanup after commit, rollback and timeout | POOL-01-001–003 | 3 PASS |
| Concurrent HTTP requests reusing one backend connection | POOL-01-004 | 1 PASS |
| Privileged action self-grant blocked | SEC-02-005 | 1 PASS |
| **Total** | | **13 PASS, 0 FAIL** |

Request body, query and header values do not replace the identity established by the middleware. Tenant selection is checked against active membership. The disposable `app_api` role is NOSUPERUSER, NOBYPASSRLS and NOCREATEROLE.

## Important limitations

1. **The identity provider is mocked.** The real auth middleware code path is exercised, but the test does not call Supabase or validate a real JWT/signature, issuer, audience, key rotation, or live user revocation.
2. **The adapter is not the production server.** The repository's current runtime still uses `better-sqlite3`; no PostgreSQL-backed production route/pool context integration is wired into `server/index.mjs`.
3. **Membership lookup uses a privileged fixture connection.** This is not an approved production resolver. Production must use a least-privilege backend-only resolver.
4. **Pool size is one.** Concurrent HTTP requests queue on the same backend connection. This proves no context bleed on a reused connection, but not multi-connection pool saturation, cancellation, failover, or leak behavior.
5. **Custom GUCs remain caller-settable by a SQL-capable `app_api` session.** Transaction-local context prevents connection reuse leakage; it is not a cryptographic identity assertion and does not defend against arbitrary SQL execution under that role.
6. **Production grants are not inspected.** The fixture revokes INSERT/UPDATE/DELETE on `transaction_access_assignment_actions`; production grants must be audited independently.

## Decision

The disposable contract is tested and passes. **RLS-016 / DEC-006 remains BLOCKED** until the actual authoritative API uses verified identity, a least-privilege membership resolver, and a PostgreSQL pool; the same adversarial and pool-reset tests must run against that production composition. No schema freeze is approved.
