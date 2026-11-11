# Export Client — Execution Status and Evidence Reconciliation

**Date:** 2026-11-11  
**Repository:** `muchlisbstg/export-client-mobile-sync`  
**Review branch:** `review/p0-domain-schema-readonly-2026-11-10`  
**Branch HEAD at review start:** `e16cc5713787f5f61640aa2150ce56baec974777`  
**Default branch:** `main`  
**Disposition:** READ-ONLY AUDIT COMPLETE; TECHNICAL GATES REMAIN OPEN

## 1. Scope and execution boundary

This review used GitHub repository metadata, branch refs, source files, commit comparisons, GitHub Actions job summaries/logs, and downloadable workflow artifacts.

- No local clone or Termux operation was used.
- No staging or production database was queried or changed.
- No migration, DDL, seed, backfill, deployment, merge, or main-branch write was performed.
- No authorization decision or reviewer approval is inferred from CI success.

## 2. Repository and candidate provenance

| Item | Verified value |
|---|---|
| Repository | `muchlisbstg/export-client-mobile-sync` |
| Default branch | `main` |
| Review branch | `review/p0-domain-schema-readonly-2026-11-10` |
| Review branch HEAD at start | `e16cc5713787f5f61640aa2150ce56baec974777` |
| Latest disposable GH-05/GH-06 tested code SHA | `1ea10b53a6579a135daff15ed72e2d7570a0a2dc` |
| GH-09 / POOL-01 / SEC-02 tested code SHA | `e402474ecceb9cd86efd3e3e39b9f24e85127b66` |
| Latest branch CI | Mobile CI run [42801898835](https://github.com/muchlisbstg/export-client-mobile-sync/actions/runs/42801898835), SUCCESS |
| Latest CI jobs | `verify` SUCCESS; `interoperability` SUCCESS |
| Latest CI artifacts | No artifacts returned for run 42801898835 |

Commit comparison confirms that `1ea10b5` is an ancestor of branch HEAD `e16cc57`. The three commits after `1ea10b5` changed only the GH-06, GH-08, and GH-05 review documents; the parity test source was not changed after its tested SHA. Commit comparison from `e402474` to `1ea10b5` shows changes to the GH-05/SEC review documents and parity/RLS test sources; `api-context-test.mjs` was not changed in that range.

**Branch governance observation:** GitHub reports the review branch as unprotected and required status-check enforcement disabled. This review did not change branch protection.

## 3. Evidence verified

### 3.1 GH-05 — Disposable PostgreSQL RLS

- Workflow run: [42801375796](https://github.com/muchlisbstg/export-client-mobile-sync/actions/runs/42801375796)
- Tested SHA: `1ea10b53a6579a135daff15ed72e2d7570a0a2dc`
- PostgreSQL image: `postgres:16.10`
- Artifact ID: `13756801226`
- Artifact SHA-256: `7cd59a0e886f021f61526bda22f5a66f4a4cbb293cd098ec45e522a2f3479347`
- Artifact contents inspected: `rls.json` reports **34 PASS, 0 FAIL**.
- Provenance limitation in artifact: `app.tenant_id` and `app.user_id` remain settable by a SQL-capable `app_api` session; identity provenance is NOT VERIFIED.

**Disposition:** Disposable RLS fixture PASS only. This does not prove production grants, production RLS, or the actual API identity boundary.

### 3.2 GH-06 — PostgreSQL / SQLite parity

- Workflow run: [42801376099](https://github.com/muchlisbstg/export-client-mobile-sync/actions/runs/42801376099)
- Tested SHA: `1ea10b53a6579a135daff15ed72e2d7570a0a2dc`
- PostgreSQL: 16.10
- SQLite: 3.53.4
- Artifact ID: `13757005838`
- Artifact SHA-256: `4a9b9d3f0a2f5a14a9775ad761d420bd4b18521b7a9a5ab79627a2e8b89cdce5`
- Artifact contents inspected: `parity.json` reports **25 PASS, 0 FAIL**; `temporal-concurrency.json` reports **4 PASS, 0 FAIL**.
- Total synthetic cases: **29 PASS, 0 FAIL**.

Coverage represented in the synthetic corpus:
- Relational and participant/tenant relationships.
- Primary/unique/composite-key and foreign-key rejection/acceptance.
- Transaction rollback behavior.
- Temporal interval boundaries, open-ended intervals, and timestamp precision.
- Concurrent overlapping binding writes.
- Revoked membership, revoked site-link, and offline replay negative cases.

**Limitations:** The corpus is synthetic and is not the complete canonical production DDL or actual migration history. It does not prove physical schema parity, deployed authorization parity, or production RLS parity. The artifact itself states that full canonical schema and AUTH-001–AUTH-015 remain outside its scope.

**Disposition:** GH-06 synthetic acceptance corpus PASS; DEC-008 remains OPEN pending canonical schema/migration reconciliation and full runtime authorization parity.

### 3.3 GH-09 / POOL-01 / SEC-02 — API identity, context reset and forgery

- Workflow run: [42800442353](https://github.com/muchlisbstg/export-client-mobile-sync/actions/runs/42800442353)
- Tested SHA: `e402474ecceb9cd86efd3e3e39b9f24e85127b66`
- PostgreSQL: 16.10
- Artifact ID: `13755906103`
- Artifact SHA-256: `9e39d21c98d9fdb1ae02821e4d28a74bb8c4ccd36b9aee1ab589c405f59765d5`
- Artifact contents inspected: **13 PASS, 0 FAIL, 1 BLOCKED (RLS-016)**.

Verified test-harness cases include:
- Forged tenant selector rejected.
- User identity supplied through header/query/body ignored.
- Forged bearer token rejected.
- User without active membership cannot select another tenant.
- Client-supplied role metadata cannot grant admin privilege.
- Transaction-local context clears after commit, rollback, and statement timeout.
- Concurrent requests do not cross-contaminate context on a max-one reused connection.
- Ordinary API role cannot self-grant the tested privileged action.

**Critical limitations:**
1. Supabase identity-provider fetch is mocked; no live JWT/signature, issuer, audience, key-rotation, or live revocation proof.
2. The test uses a disposable Express adapter, not the repository production server.
3. Membership lookup uses a privileged fixture connection, not a production least-privilege resolver.
4. Pool size is one; multi-connection saturation, cancellation, failover, and connection-leak behavior are not proven.
5. The production API remains SQLite-backed; no production PostgreSQL pool/context composition is wired into the server.
6. Cross-tenant negative outcomes are demonstrated in the disposable harness, not across the complete production route/resource matrix.

**Disposition:** GH-09, POOL-01 and SEC-02 disposable contract tests PASS WITH LIMITATIONS. RLS-016 remains BLOCKED. This is not production API security approval.

## 4. Database and architecture reconciliation

| Work item | Current disposition | Evidence gap |
|---|---|---|
| DB-01 | OPEN | Full migration history and physical schema inventory not reconciled to the running API database |
| SEC-01 | OPEN | Production roles, grants, ownership, RLS policies, views, functions, partitions and bypass paths not verified |
| AUTH-01 | OPEN | Live verified identity and least-privilege production membership resolver not integrated |
| ARCH-01 | OPEN | Production runtime still documents/uses SQLite; PostgreSQL authoritative composition not proven |
| API-01 | OPEN | No PostgreSQL route/pool/context integration in the production API |
| GH-09 | PASS WITH LIMITATIONS | Disposable adapter only; RLS-016 blocked |
| POOL-01 | PASS WITH LIMITATIONS | Single-connection disposable pool only |
| SEC-02 | PASS WITH LIMITATIONS | Harness-level forgery tests; production route matrix outstanding |
| GH-06 | PASS — SYNTHETIC ONLY | 29/29 synthetic parity cases; canonical DDL parity remains open |
| GH-08 | REVIEW PACKAGE PREPARED | Evidence reconciled here; independent approvals and production evidence remain outstanding |

## 5. Independent review and blocker register

GitHub issues:
- [#124 — P0 Schema Design Review](https://github.com/muchlisbstg/export-client-mobile-sync/issues/124): OPEN; transaction-party bridge and tenant-scoped composite constraints require design decision and independent Database review.
- [#125 — P0 Security Review](https://github.com/muchlisbstg/export-client-mobile-sync/issues/125): OPEN; independent Security reviewer required; reviewer identity has not been appointed.

Decision register remains unchanged:

| Item | Status |
|---|---|
| DEC-006 | OPEN |
| DEC-007 | PARTIALLY EVIDENCED |
| DEC-008 | OPEN |
| RLS-016 | BLOCKED |
| Schema Freeze | NOT APPROVED |

## 6. Required next execution sequence

1. **DB-01:** obtain owner-authorized read-only inventory of the actual API runtime/database identity, migration ledger, schema objects, constraints, indexes, ownership and fingerprints. Do not export operational rows or secrets.
2. **SEC-01:** inventory actual role attributes, grants, policies, owner/BYPASSRLS paths, views, functions and partitions against the intended production role model.
3. **AUTH-01 / GH-09:** integrate real verified Supabase identity and a least-privilege membership resolver into the authoritative API; then repeat forgery and membership tests against that exact composition.
4. **ARCH-01 / API-01:** implement PostgreSQL as authoritative backend only on a review branch after domain/schema decisions and independent design review; preserve explicit SQLite responsibility boundaries.
5. **POOL-01:** test multiple pooled connections, commit, rollback, timeout, cancellation, concurrent acquisition, release/reset and failure cleanup against the actual API composition.
6. **SEC-02:** extend negative-access tests across the complete production route/resource matrix, including cross-tenant reads and mutations, object-ID substitution, role escalation, revocation and denied-write immutability.
7. **GH-06:** run the parity corpus against the full canonical DDL and reconciled migrations; add explicit authorization-decision parity for matching principal/tenant/resource/action cases.
8. **GH-08:** rerun evidence collection on one pinned candidate SHA, attach CI logs and artifacts, reconcile artifact digests, and obtain independent Security and Database decisions.

## 7. Final decision

**Technical evidence collection has progressed, but PostgreSQL is NOT APPROVED as the authoritative production backend.**

The disposable GH-05/GH-06/GH-09 test results are valid only within their stated fixtures and tested SHAs. They do not close DEC-006/007/008, RLS-016, or schema freeze.

No merge, deployment, migration, staging/production mutation, or main-branch write was performed in this execution.
