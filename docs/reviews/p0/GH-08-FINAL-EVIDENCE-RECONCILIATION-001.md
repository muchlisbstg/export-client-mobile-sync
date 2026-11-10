# GH-08 — Final Evidence Reconciliation

**Decision:** DISPOSABLE TEST EVIDENCE ACCEPTED WITH LIMITATIONS  
**Security sign-off:** NOT APPROVED  
**Schema freeze:** NOT APPROVED  
**Date:** 2026-11-10  
**Repository:** `muchlisbstg/export-client-mobile-sync`  
**Branch:** `review/p0-domain-schema-readonly-2026-11-10`  
**Latest tested code SHA:** `1ea10b53a6579a135daff15ed72e2d7570a0a2dc`

## 1. Evidence register

| Gate | Run / tested SHA | Result | Evidence |
|---|---|---|---|
| GH-05 RLS | [42801375796](https://github.com/muchlisbstg/export-client-mobile-sync/actions/runs/42801375796) / `1ea10b53a6579a135daff15ed72e2d7570a0a2dc` | 34 PASS, 0 FAIL | Artifact `13756801226`, SHA-256 `7cd59a0e886f021f61526bda22f5a66f4a4cbb293cd098ec45e522a2f3479347` |
| GH-05 embedded parity | same run / same SHA | 25 relational + 4 temporal PASS | Included in GH-05 artifact |
| GH-06 parity | [42801376099](https://github.com/muchlisbstg/export-client-mobile-sync/actions/runs/42801376099) / `1ea10b53a6579a135daff15ed72e2d7570a0a2dc` | 25 relational + 4 temporal PASS | Artifact `13757005838`, SHA-256 `4a9b9d3f0a2f5a14a9775ad761d420bd4b18521b7a9a5ab79627a2e8b89cdce5` |
| GH-09 / POOL-01 / SEC-02 | [42800442353](https://github.com/muchlisbstg/export-client-mobile-sync/actions/runs/42800442353) / `e402474ecceb9cd86efd3e3e39b9f24e85127b66` | 13 PASS, 0 FAIL; RLS-016 BLOCKED | Artifact `13755906103`, SHA-256 `9e39d21c98d9fdb1ae02821e4d28a74bb8c4ccd36b9aee1ab589c405f59765d5` |
| Mobile CI | [42801375937](https://github.com/muchlisbstg/export-client-mobile-sync/actions/runs/42801375937) / `1ea10b53a6579a135daff15ed72e2d7570a0a2dc` | SUCCESS | Workflow run |

All disposable database workflows completed successfully. PostgreSQL 16.10 was used; GH-06 parity also used SQLite 3.53.4. Artifacts contain synthetic test evidence only.

## 1A. CI job-log review

Full decoded job logs were retrieved and inspected for all three evidence workflows:

| Workflow | Job log lines | Review result |
|---|---:|---|
| GH-05 combined disposable RLS/parity | 536 | Expected constraint, trigger, permission and RLS rejections align with negative assertions; no unexpected failing step |
| GH-06 disposable parity | 484 | Expected FK, unique, check, trigger and temporal-overlap rejections align with parity assertions; no unexpected failing step |
| GH-09 / POOL-01 / SEC-02 | 444 | Deliberate division-by-zero rollback, statement timeout and privilege-map denial align with fault-injection assertions; no unexpected failing step |

Non-blocking CI/runtime warnings observed:
- GitHub warns that `actions/checkout@v4`, `actions/setup-node@v4` and `actions/upload-artifact@v4` target Node.js 20 and are currently forced onto Node.js 24.
- Node dependency deprecation warning for `punycode`.
- Disposable PostgreSQL container initializes local connections with `trust` authentication. This is a container bootstrap detail, not evidence of production authentication posture.
- PostgreSQL error log entries are intentional negative-test evidence (constraint/RLS/permission denials, rollback and timeout), not failed assertions. All three workflow conclusions are SUCCESS and the uploaded machine-readable artifacts report zero failed cases.


## 2. Findings and remediations

### SEC-GH05-04 — Membership self-enrollment

The initial fixture allowed app_api membership INSERT where WITH CHECK only required the row's user to equal the caller-set session user. This enabled a self-enrollment attempt. It was detected in source review, not by the original 31-test suite.

**Fix:** app_api membership grant changed to SELECT-only. Membership lifecycle changes are reserved for a separately authorized service boundary.

**Regression evidence:** RLS-033 self-enrollment, RLS-034 self-reactivation, RLS-035 membership deletion/revocation. All passed. Latest GH-05 result: 34/34 PASS.

### Privilege map and audit history

- app_api is SELECT-only on transaction_access_assignment_actions.
- RLS-029–031 reject self-grant, privilege rewrite and deletion.
- RLS-017/RLS-032 reject audit DELETE/UPDATE.

### Canonical parity corpus

The GH-06 runner now maps all PAR-001–PAR-019 scenarios and KEY-001–KEY-020 constraints to 25 relational/authorization cases plus 4 temporal/concurrency cases. All 29 cases pass on the synthetic PostgreSQL/SQLite fixtures. This is not evidence that the entire production canonical DDL has parity.

## 3. Production security blockers

1. The current production API remains SQLite-backed. No authoritative PostgreSQL route/pool/context composition is wired into the production server.
2. GH-09 uses a mocked identity-provider fetcher. It executes the repository's real `createSupabaseAuth` middleware but does not validate a live Supabase token/signature, issuer, audience, key rotation or live user revocation.
3. GH-09 membership lookup uses a privileged fixture connection, not a production least-privilege resolver.
4. POOL-01 uses a max-one pool. It proves transaction-local context cleanup on commit, rollback, timeout and reuse in the test adapter, but not production multi-connection saturation/cancellation/failover.
5. PostgreSQL custom GUCs `app.tenant_id` and `app.user_id` remain settable by a SQL-capable app_api session. Pool reset is not a cryptographic identity assertion; arbitrary SQL under app_api remains outside the proven boundary.
6. Production grants, full schema object inventory, owner/bypass roles, SECURITY DEFINER functions, views and partitions remain unreviewed.

## 4. Gate disposition

| Gate / decision | Disposition | Rationale |
|---|---|---|
| GH-05 disposable RLS | PASS | 34/34 synthetic RLS tests |
| GH-06 synthetic parity acceptance | PASS | 25 relational + 4 temporal cases, 0 failures |
| GH-09 disposable API contract | PASS WITH LIMITATIONS | 13/13 tests; mocked IdP and test-only adapter; RLS-016 blocked |
| POOL-01 disposable reset | PASS WITH LIMITATIONS | Commit/rollback/timeout/reuse tested; max-one pool |
| SEC-02 disposable forgery/self-grant | PASS WITH LIMITATIONS | Forged request fields and self-grant denied in harness |
| RLS-016 production provenance | BLOCKED | Production API has no PostgreSQL context integration |
| DB-01 migration/schema inventory | OPEN | Full physical schema and migration history not reconciled |
| SEC-01 production roles/grants/RLS | OPEN | Production role/grant/policy inventory not evidenced |
| AUTH-01 authoritative resolver | OPEN | Production membership resolver not integrated |
| ARCH-01 authoritative backend | OPEN | Current runtime remains SQLite-backed |
| API-01 PostgreSQL pool integration | OPEN | No production PostgreSQL route/pool integration |
| TEST-01 full negative-access suite | OPEN | Synthetic subset passes; production composition and full AUTH matrix unverified |
| DEC-006 | OPEN | Production RLS/API identity boundary not proven |
| DEC-007 | PARTIALLY EVIDENCED | Actual deployed SQLite process/path/connection provenance not closed |
| DEC-008 | OPEN | Synthetic parity passes; full canonical production DDL not reconciled |
| Schema freeze | NOT APPROVED | DEC-006/007/008 remain open |

## 5. Required next work

1. DB-01: read-only inventory of migration history, full physical schema, ownership, constraints, indexes and grants.
2. SEC-01: inspect actual production role attributes, grants, policies, views, functions, partitions and bypass paths.
3. AUTH-01 / GH-09: implement and test verified identity with live Supabase verification and a least-privilege membership resolver in the authoritative API.
4. API-01 / POOL-01: integrate PostgreSQL pool context into actual server composition and test multiple pooled connections, concurrent acquisition, cancellation and failure cleanup.
5. DEC-007: obtain authorized runtime provenance for the actual SQLite process/path and all connection constructors.
6. GH-06 / DEC-008: execute the 29-case corpus against full canonical DDL and reconcile all migrations/physical objects.
7. Independent Security and Database reviewers must review evidence and record explicit dispositions before schema freeze is reconsidered.

## 6. Scope and governance confirmation

No migration was created or applied. No staging or production database was accessed or changed. No Web/Mobile/Desktop production app was connected. No merge, deployment, main-branch write or schema freeze was performed.

This reconciliation accepts the disposable test evidence only. It is not authorization for PostgreSQL cutover or financial transaction implementation.
