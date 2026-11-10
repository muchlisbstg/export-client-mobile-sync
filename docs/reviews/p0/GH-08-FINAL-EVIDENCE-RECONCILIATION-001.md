# GH-08 — Final Evidence Reconciliation

**Decision:** PARTIAL EVIDENCE ACCEPTED FOR DISPOSABLE TEST HARNESS ONLY  
**Security sign-off:** NOT APPROVED  
**Schema freeze:** NOT APPROVED  
**Date:** 2026-11-10  
**Repository:** `muchlisbstg/export-client-mobile-sync`  
**Branch:** `review/p0-domain-schema-readonly-2026-11-10`  
**Latest branch commit at review:** `e4f508fd20ecf4eb6dbe2f769c20962f26b6c11e`

## 1. Evidence register

| Gate | Run / tested SHA | Result | Evidence |
|---|---|---|---|
| GH-05 RLS | [42779795716](https://github.com/muchlisbstg/export-client-mobile-sync/actions/runs/42779795716) / `e24c4c43c7beb63a383f26a3bf0f21e7096ee381` | 31 PASS, 0 FAIL | Artifact `13745517809`, SHA-256 `3815ba9153e6bf2a77116c553ae7f8647d6140db53e38fc11d6afa49271c5c96` |
| GH-05 embedded parity | same run / same SHA | 15 PASS, 0 FAIL | Included in GH-05 artifact |
| GH-06 parity | [42778235005](https://github.com/muchlisbstg/export-client-mobile-sync/actions/runs/42778235005) / `da4534b0b30cfcbc66a64c879e028e519b95d996` | 15 relational + 4 temporal PASS | Artifact `13744827342`, SHA-256 `5c8b41af1742f104be7f917280942135ed122734d4f7b92002c22249301db8d6` |
| GH-09 / POOL-01 / SEC-02 | [42778888308](https://github.com/muchlisbstg/export-client-mobile-sync/actions/runs/42778888308) / `31bcb316d8346c6e6c665d5817aab307d0c98bc3` | 13 PASS, 0 FAIL; RLS-016 BLOCKED | Artifact `13744653963`, SHA-256 `73ecb9de622e47a9a1836eb6707eefc8dc1b8784b32459f3f44a4cc68856438a` |
| Mobile CI | [42778888556](https://github.com/muchlisbstg/export-client-mobile-sync/actions/runs/42778888556) / `31bcb316d8346c6e6c665d5817aab307d0c98bc3` | Verify + interoperability PASS | Workflow logs |

All three evidence artifacts expire on 2026-12-10. Each workflow used a disposable PostgreSQL 16.10 service. GH-06 also recorded SQLite 3.53.4.

## 2. Security evidence findings

### Passed within disposable fixtures

- 31 RLS negative/positive tests passed, including membership isolation, tenant scoping, cross-participant/site-link denial, and audit UPDATE/DELETE denial.
- The ordinary `app_api` role has no INSERT/UPDATE/DELETE grant on `transaction_access_assignment_actions`; RLS-029–031 prove self-grant and rewrite attempts fail in the fixture.
- The GH-09 HTTP adapter invoked the repository's `createSupabaseAuth` middleware. Forged identity and tenant inputs did not replace the middleware identity.
- Pool context was transaction-local and cleared after commit, rollback, and statement timeout. Concurrent HTTP requests did not cross-contaminate the single reused backend connection.
- The synthetic temporal test serialized overlapping writes and allowed adjacent half-open intervals.

### Production blockers remain

1. The repository production API still uses SQLite; no PostgreSQL-backed authoritative route or pool/context middleware is wired into `server/index.mjs`.
2. GH-09 uses a mocked identity-provider fetcher. It exercises the real auth middleware code, but does not validate a live Supabase token, issuer, audience, signature, rotation, or live user revocation.
3. The GH-09 membership lookup uses an admin fixture connection, not a production least-privilege resolver.
4. The pool test uses `max:1`; it does not prove multi-connection pool saturation, cancellation, failover, or leak behavior.
5. PostgreSQL custom GUCs `app.tenant_id` and `app.user_id` remain settable by a SQL-capable `app_api` session. Transaction-local use prevents pool leakage, but is not a cryptographic identity assertion and does not defend against arbitrary SQL execution under that role.
6. Production database grants for `transaction_access_assignment_actions` have not been audited. The fixture's SELECT-only grant must be carried into the approved production privilege design.
7. GH-06's 19 passes are synthetic subset evidence. The canonical KEY/PAR/AUTH matrix has direct-test gaps and the complete canonical schema is not under parity execution.

## 3. Gate disposition

| Gate / decision | Disposition | Rationale |
|---|---|---|
| GH-05 disposable RLS | PASS | 31/31 evidence in run 42779795716 |
| GH-06 synthetic parity harness | PASS WITH LIMITATIONS | 19/19 synthetic cases, but canonical matrix gaps remain |
| GH-09 disposable API trust-boundary contract | PASS WITH LIMITATIONS | 13/13 adapter tests; mocked IdP and non-production API |
| POOL-01 disposable connection reset | PASS WITH LIMITATIONS | Commit/rollback/timeout/reuse covered; max-one pool only |
| SEC-02 disposable forgery/self-grant tests | PASS WITH LIMITATIONS | Request forgery and fixture privilege-map write denied |
| RLS-016 production provenance | BLOCKED | Production API has no PostgreSQL context integration |
| DEC-006 PostgreSQL RLS in authoritative API | OPEN | Actual production route/role/resolver not integrated or verified |
| DEC-007 SQLite provenance | PARTIALLY EVIDENCED | Production SQLite runtime remains; deployed process/path/connection inventory not closed |
| DEC-008 canonical PostgreSQL/SQLite parity | OPEN | Synthetic schema and missing direct acceptance rows |
| Schema freeze | NOT APPROVED | DEC-006/007/008 not closed |

## 4. Required next work

1. Approve the authoritative PostgreSQL API design, verified identity boundary, and least-privilege membership resolver before wiring production routes.
2. Implement and test real Supabase identity verification and transaction-local context on the actual production API composition.
3. Extend POOL-01 to multiple pooled connections, concurrent acquisition, timeout/cancel, rollback, release and reuse.
4. Add direct tests for every uncovered KEY/PAR/AUTH row using the canonical schema DDL; align runner IDs exactly with the acceptance matrix.
5. Audit actual production grants and preserve SELECT-only access to privilege mappings for ordinary application roles unless a separately authorized grant-management service is approved.
6. Re-run GH-05/GH-06/GH-09 against the exact candidate SHA; complete DB-01, SEC-01, AUTH-01, ARCH-01, API-01 and TEST-01 reconciliation.
7. Only then submit schema-freeze recommendation for human review.

## 5. Scope and governance confirmation

No migration was created or applied. No staging or production database was accessed or changed. No Web/Mobile/Desktop production app was connected. No merge, deployment, main-branch write, branch-protection change, or approval was performed.

This reconciliation is an evidence report, not authorization to implement the production PostgreSQL cutover.
