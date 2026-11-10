# GH-08 — Final Evidence Reconciliation

**Decision:** PARTIAL EVIDENCE ACCEPTED FOR DISPOSABLE TEST HARNESS ONLY  
**Security sign-off:** NOT APPROVED  
**Schema freeze:** NOT APPROVED  
**Date:** 2026-11-10  
**Repository:** `muchlisbstg/export-client-mobile-sync`  
**Branch:** `review/p0-domain-schema-readonly-2026-11-10`  
**Latest code-evidence SHA:** `e4f508fd20ecf4eb6dbe2f769c20962f26b6c11e`  
**Documentation commit:** `4afca80561f90639723e5b728aae7d2be626fcbb`

## 1. Evidence register

| Gate | Run / tested SHA | Result | Evidence |
|---|---|---|---|
| GH-05 RLS | [42780098856](https://github.com/muchlisbstg/export-client-mobile-sync/actions/runs/42780098856) / `e4f508fd20ecf4eb6dbe2f769c20962f26b6c11e` | 31 PASS, 0 FAIL | Artifact `13745513133`, SHA-256 `8e2995500ac271c22dffa7c41a812cc2d6c964ae4aae20ff0a3ba930cc8367b4` |
| GH-05 embedded parity | same run / same SHA | 15 PASS, 0 FAIL | Included in GH-05 artifact |
| GH-06 parity | [42780099356](https://github.com/muchlisbstg/export-client-mobile-sync/actions/runs/42780099356) / `e4f508fd20ecf4eb6dbe2f769c20962f26b6c11e` | 15 relational + 4 temporal PASS | Artifact `13745991104`, SHA-256 `17086ddf15524520e402257e44da80c82f0a78d81addb67e418b163c77b8b75f` |
| GH-09 / POOL-01 / SEC-02 | [42778888308](https://github.com/muchlisbstg/export-client-mobile-sync/actions/runs/42778888308) / `31bcb316d8346c6e6c665d5817aab307d0c98bc3` | 13 PASS, 0 FAIL; RLS-016 BLOCKED | Artifact `13744653963`, SHA-256 `73ecb9de622e47a9a1836eb6707eefc8dc1b8784b32459f3f44a4cc68856438a` |
| Mobile CI | [42780099111](https://github.com/muchlisbstg/export-client-mobile-sync/actions/runs/42780099111) / `e4f508fd20ecf4eb6dbe2f769c20962f26b6c11e` | Verify + interoperability PASS | Workflow logs |

Artifacts expire on 2026-12-10. GH-05/GH-06/GH-09 used disposable PostgreSQL 16.10; GH-06 also recorded SQLite 3.53.4.

## 2. Security evidence findings

### Passed within disposable fixtures

- 31 RLS tests passed, including membership isolation, tenant scoping, cross-participant/site-link denial, audit UPDATE/DELETE denial, and permission-mapping write denial.
- The ordinary `app_api` role has no INSERT/UPDATE/DELETE grant on `transaction_access_assignment_actions`; RLS-029–031 prove self-grant and rewrite attempts fail in the fixture.
- The GH-09 HTTP adapter invokes the repository's actual `createSupabaseAuth` middleware. Forged identity and tenant inputs do not replace the middleware identity.
- Pool context is transaction-local and clears after commit, rollback and statement timeout. Concurrent requests do not cross-contaminate the single reused backend connection.
- The synthetic temporal test serializes overlapping writes and allows adjacent half-open intervals.

### Production blockers remain

1. The production API still uses SQLite; no PostgreSQL-backed authoritative route or pool/context middleware is wired into `server/index.mjs`.
2. GH-09 uses a mocked identity-provider fetcher. It exercises the real auth middleware code, but does not validate a live Supabase token, issuer, audience, signature, rotation, or live user revocation.
3. The GH-09 membership lookup uses a privileged fixture connection, not a production least-privilege resolver.
4. The pool test uses `max:1`; it does not prove multi-connection pool saturation, cancellation, failover, or leak behavior.
5. PostgreSQL custom GUCs `app.tenant_id` and `app.user_id` remain settable by a SQL-capable `app_api` session. Transaction-local use prevents pool leakage, but is not a cryptographic identity assertion and does not defend against arbitrary SQL execution under that role.
6. Production database grants for `transaction_access_assignment_actions` have not been audited. The fixture's SELECT-only grant must be carried into the approved production privilege design.
7. GH-06's 19 passes are synthetic subset evidence. The canonical KEY/PAR/AUTH matrix has direct-test gaps and the complete canonical schema is not under parity execution.

## 3. Gate disposition

| Gate / decision | Disposition | Rationale |
|---|---|---|
| GH-05 disposable RLS | PASS | 31/31 evidence in run 42780098856 |
| GH-06 synthetic parity harness | PASS WITH LIMITATIONS | 19/19 synthetic cases; canonical matrix gaps remain |
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
4. Add direct tests for every uncovered KEY/PAR/AUTH row using canonical schema DDL; align runner IDs exactly with the acceptance matrix.
5. Audit actual production grants and preserve SELECT-only access to privilege mappings for ordinary application roles unless a separately authorized grant-management service is approved.
6. Re-run GH-05/GH-06/GH-09 against the exact candidate SHA; complete DB-01, SEC-01, AUTH-01, ARCH-01, API-01 and TEST-01 reconciliation.
7. Only then submit schema-freeze recommendation for human review.

## 5. Scope and governance confirmation

No migration was created or applied. No staging or production database was accessed or changed. No Web/Mobile/Desktop production app was connected. No merge, deployment, main-branch write, branch-protection change, or approval was performed.

This reconciliation is an evidence report, not authorization to implement the production PostgreSQL cutover.
