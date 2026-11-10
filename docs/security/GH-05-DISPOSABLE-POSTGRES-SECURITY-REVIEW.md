# GH-05 Disposable PostgreSQL Security Evidence Review

**Review date:** 2026-11-10  
**Candidate branch:** `review/p0-domain-schema-readonly-2026-11-10`  
**Reviewed commit:** `69b45d25fd6f2db75f2ba32b3becb4717bbd5375`  
**Workflow run:** [42773719577](https://github.com/muchlisbstg/export-client-mobile-sync/actions/runs/42773719577)  
**PostgreSQL:** 16.10  
**Environment:** Disposable GitHub Actions service container only

## Decision

**GH-05 database-policy test suite: PASS WITH LIMITATIONS.**  
**Overall security sign-off / schema freeze: NOT APPROVED.**

The pass applies only to the disposable PostgreSQL policy behavior under a trusted tenant/user context. It is not evidence that the API establishes that context securely. GH-09 identity provenance remains a mandatory blocker.

## Evidence reviewed

- Workflow job logs: 490 lines; job and all steps completed successfully.
- Fixture initialization: exit code 0.
- RLS suite: 27 passed, 0 failed.
- PostgreSQL–SQLite parity subset: 10 passed, 0 failed.
- Evidence artifact: `p0-disposable-db-gates-69b45d25fd6f2db75f2ba32b3becb4717bbd5375`.
- Artifact SHA-256: `953dcafa7261cf3ef2fc7c072c897d38ca4dfafa02530bcaef58ffaa0d5bfc36`.
- Artifact retention: 30 days; expires 2026-12-10.

## Remediation verified

Membership-active checks were added to tenant-scoped read/write policies for:

- tenants
- commercial_transactions
- transaction_participants
- supply_sites
- transaction_site_links
- audit_events

Additional negative-access coverage verifies that a user without active membership cannot read these tenant-scoped resources, and that a second active member in the same tenant cannot read assignment actions assigned to another membership.

## Security limitations / blockers

### SEC-GH05-01 — Identity provenance is not proven

The policies read `app.tenant_id` and `app.user_id` through custom PostgreSQL settings. The `app_api` database role can call `set_config()` and choose these values. The disposable tests intentionally set these values to exercise RLS; they do not prove the values were derived from a verified end-user identity.

**Required evidence:** GH-09 must prove that only the trusted API boundary establishes context from a verified identity, that clients cannot access database credentials or arbitrary SQL execution, and that pooled connections clear/replace context transactionally. If arbitrary SQL access using `app_api` is in the threat model, the context design must be changed to a database-verifiable identity assertion rather than trusting caller-settable GUCs.

### SEC-GH05-02 — Parity coverage is partial

The parity artifact explicitly covers only 10 executable cases. Temporal concurrent writes, lifecycle/offline replay, complete approval semantics, and RLS parity remain outside this subset. Do not report DEC-008 as fully passed.

### SEC-GH05-03 — Non-blocking runner warnings

- Node dependency deprecations: `punycode` and legacy `url.parse()`.
- GitHub Actions warns that checkout/setup-node/upload-artifact v4 currently target Node 20 and are being forced onto Node 24.
- PostgreSQL initdb reports local socket trust authentication in the disposable container. This is not evidence of production authentication configuration.
- PostgreSQL negative-test constraint/RLS errors are expected rejection evidence; container logical-replication launcher shutdown message occurs during disposable container teardown.

These warnings did not fail the workflow and do not change the security decision above.

## Required next gates

1. GH-09: verify signed/verified identity provenance and API-only context establishment.
2. Pool tests: prove transaction-local context reset on commit, rollback, timeout, and reused connections.
3. Add adversarial test for attempted identity/tenant context substitution at the API boundary.
4. Expand parity beyond the current 10-case subset and retain the explicit scope note until all DEC-008 acceptance criteria are covered.
5. Conduct final evidence reconciliation across DB-01, SEC-01, AUTH-01, ARCH-01, API-01, and TEST-01.

## Scope guardrails

No migrations were created or applied. No staging/production database was modified. No Web, Mobile, or Desktop application was connected. No merge or deployment was performed.
