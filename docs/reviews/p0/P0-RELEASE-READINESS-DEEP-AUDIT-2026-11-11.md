# P0 Release Readiness — Deep Audit

**Audit date:** 2026-11-11  
**Repository:** `muchlisbstg/export-client-mobile-sync`  
**Audit base branch:** `review/p0-domain-schema-readonly-2026-11-10`  
**Audit base SHA:** `53ec212dbf793293585a1d0f954a39f7fbae9317`  
**Audit branch:** `audit/p0-release-readiness-deep-2026-11-11`  
**Method:** GitHub remote read-only inspection; full workflow job logs retrieved; available ZIP artifacts downloaded and inspected.  
**Disposition:** NOT RELEASE READY — P0 approval withheld.

## 1. Executive decision

The available disposable tests and latest Mobile CI are green within their declared scopes. They do not establish production-grade tenant identity provenance, canonical PostgreSQL schema parity, production RLS, or independent Security/Database approval.

**Release decision: BLOCKED.** Do not treat this report or CI success as authorization to merge, migrate, deploy, freeze schema, or enable real-money transactions.

## 2. Status vocabulary

- **PASS** — exact test/evidence passed within the declared scope.
- **FAIL** — an observed control or quality gate did not meet the stated release expectation.
- **BLOCKED** — a required decision, integration, reviewer, or prerequisite is outstanding.
- **NOT VERIFIED** — evidence is absent or insufficient to make a reliable determination.

A scoped PASS does not automatically close a broader release gate.

## 3. Evidence provenance

| Evidence | Workflow run | Tested SHA | Artifact |
|---|---:|---|---|
| GH-05 disposable PostgreSQL RLS | [42801375796](https://github.com/muchlisbstg/export-client-mobile-sync/actions/runs/42801375796) | `1ea10b53a6579a135daff15ed72e2d7570a0a2dc` | [13756801226](https://github.com/muchlisbstg/export-client-mobile-sync/actions/runs/42801375796/artifacts/13756801226) |
| GH-06 PostgreSQL/SQLite parity | [42801376099](https://github.com/muchlisbstg/export-client-mobile-sync/actions/runs/42801376099) | `1ea10b53a6579a135daff15ed72e2d7570a0a2dc` | [13757005838](https://github.com/muchlisbstg/export-client-mobile-sync/actions/runs/42801376099/artifacts/13757005838) |
| GH-09 / POOL-01 / SEC-02 context harness | [42800442353](https://github.com/muchlisbstg/export-client-mobile-sync/actions/runs/42800442353) | `e402474ecceb9cd86efd3e3e39b9f24e85127b66` | [13755906103](https://github.com/muchlisbstg/export-client-mobile-sync/actions/runs/42800442353/artifacts/13755906103) |
| GH-08 evidence reconciliation record | [Commit 53ec212](https://github.com/muchlisbstg/export-client-mobile-sync/commit/53ec212dbf793293585a1d0f954a39f7fbae9317) | `53ec212dbf793293585a1d0f954a39f7fbae9317` | [Execution status report](../EXPORT-CLIENT-EXECUTION-STATUS-2026-11-11.md) |
| Latest Mobile CI | [42943494547](https://github.com/muchlisbstg/export-client-mobile-sync/actions/runs/42943494547) | `53ec212dbf793293585a1d0f954a39f7fbae9317` | No artifacts |

Artifact SHA-256 values:
- GH-05: `7cd59a0e886f021f61526bda22f5a66f4a4cbb293cd098ec45e522a2f3479347`
- GH-06: `4a9b9d3f0a2f5a14a9775ad761d420bd4b18521b7a9a5ab79627a2e8b89cdce5`
- GH-09: `9e39d21c98d9fdb1ae02821e4d28a74bb8c4ccd36b9aee1ab589c405f59765d5`

The GH-05 and GH-06 tests ran on SHA `1ea10b5`; GH-09 ran on earlier SHA `e402474`. The report/evidence reconciliation commit is newer. These are not one-SHA end-to-end security and database proofs.

## 4. Gate-by-gate findings

### 4.1 GH-05 — Disposable PostgreSQL RLS

**Status: PASS (fixture only) / BLOCKED (release gate) / NOT VERIFIED (identity provenance).**

Evidence:
- PostgreSQL `16.10`, disposable fixture.
- Artifact `rls.json`: 34 PASS, 0 FAIL.
- Fixture initialization exit code: 0.
- Artifact manifest binds the test to SHA `1ea10b5`.

Critical limitation:
- Artifact explicitly reports `context_provenance = NOT_VERIFIED`.
- Custom settings `app.tenant_id` and `app.user_id` remain settable by a SQL-capable `app_api` session.
- Therefore the fixture does not prove that tenant/user identity is cryptographically or otherwise authoritatively derived from a verified caller identity.
- It does not prove production grants, production policies, production ownership/BYPASSRLS paths, or the actual production API/database composition.

Log interpretation:
- PostgreSQL ERROR entries during negative test execution correspond to intentionally rejected duplicate keys, invalid FKs, RLS violations, permission-denied writes, and immutable-audit cases. They are expected test stimuli, not by themselves test failures.
- CI also reports five moderate npm vulnerabilities in the mobile dependency install.

Required closure:
1. Establish an identity provenance mechanism that an ordinary SQL-capable application role cannot forge.
2. Verify actual role attributes, grants, ownership, policies, views, functions, partitions, and bypass paths.
3. Exercise the production API composition and prove tenant/user context cannot be forged or leaked across requests.
4. Obtain independent Security approval.

### 4.2 GH-06 — PostgreSQL / SQLite parity

**Status: PASS (synthetic corpus) / BLOCKED (DEC-008) / NOT VERIFIED (canonical schema parity).**

Evidence:
- PostgreSQL `16.10`; SQLite `3.53.4`.
- `parity.json`: 25 PASS, 0 FAIL.
- `temporal-concurrency.json`: 4 PASS, 0 FAIL.
- Combined synthetic cases: 29 PASS, 0 FAIL.
- Coverage includes key/unique/composite-key behavior, tenant/site relationships, transaction rollback, effective-period boundaries, concurrency, revocation, and offline replay.

Limitations:
- Corpus is a synthetic relational/authorization subset, not the complete canonical production DDL or actual migration history.
- Artifact states full canonical schema and AUTH-001–AUTH-015 are outside its scope.
- It does not prove physical schema parity, deployed authorization parity, or production RLS parity.
- DEC-008 remains OPEN.

Required closure:
1. Reconcile the complete canonical schema and migration ledger.
2. Run equivalent positive and negative cases against that complete schema on both engines.
3. Include transaction behavior, temporal precision, concurrency, tenant/site composite constraints, and authorization-decision parity.
4. Obtain independent Database review and Security concurrence.

### 4.3 GH-08 — Evidence reconciliation and release evidence

**Status: BLOCKED.**

Evidence:
- Reconciliation document exists at `docs/reviews/p0/EXPORT-CLIENT-EXECUTION-STATUS-2026-11-11.md`.
- Latest branch commit is `53ec212`.
- Latest Mobile CI run `42943494547` completed successfully: `verify` and `interoperability`.
- Latest run produced no workflow artifacts.
- Earlier GH-08-related Mobile CI runs `42801792899` and `42801898835` also completed successfully, but produced no artifacts.

Gaps:
- Evidence exists, but independent Security and Database approvals are not recorded.
- Evidence is split across multiple tested SHAs rather than a single pinned end-to-end candidate.
- Latest CI success is not a substitute for attaching and reconciling gate-specific artifacts.
- Review branch was previously observed as unprotected with required status-check enforcement disabled.

Required closure:
1. Pin one candidate SHA for all relevant gate runs.
2. Attach logs, sanitized artifacts, SHA-256 digests, test scope, and limitations to the evidence register.
3. Record reviewer identity, exact reviewed SHA, decision, findings, and timestamp.
4. Verify branch protection and required checks before any merge consideration.

### 4.4 GH-09 / POOL-01 / SEC-02 — API identity, pool context, and forgery resistance

**Status: PASS (disposable harness cases) / BLOCKED (RLS-016) / NOT VERIFIED (production integration).**

Evidence:
- Artifact `api-context.json`: 13 PASS, 0 FAIL, 1 BLOCKED.
- Cases include unauthenticated rejection, forged tenant selector rejection, active-membership tenant derivation, revoked membership denial, forged identity claims ignored, client role claims not granting admin, transaction-local context reset after commit/rollback/timeout, concurrent requests on a reused connection, and ordinary role privilege restrictions.

Explicit blocker:
- RLS-016 is BLOCKED because the test uses a disposable Express adapter, not the repository production server.
- The production API is still SQLite-backed and has no PostgreSQL pool/context integration.

Additional NOT VERIFIED items:
- Real Supabase JWT signature, issuer, audience, key rotation, and live revocation.
- Production least-privilege membership resolver.
- Multi-connection pool saturation, cancellation, failover, and connection-leak cleanup; current harness uses pool size one.
- Complete production route/resource negative-access matrix.
- End-to-end cross-tenant read/write denial and denied-write immutability across all route families.

Required closure:
1. Integrate real verified identity and least-privilege membership resolution into the authoritative API.
2. Test against the actual production server composition, not a test-only adapter.
3. Exercise multi-connection pool lifecycle and failure paths.
4. Complete the route × role × tenant × transaction × site negative-access matrix.
5. Obtain independent Security approval.

## 5. Latest CI and dependency findings

Latest run `42943494547`:
- `verify`: SUCCESS.
- `interoperability`: SUCCESS.
- API/client and P0 test command: 119 passed, 0 failed.
- Android JavaScript bundle export step completed.
- Cross-repository synthetic synchronization: 3 synthetic inquiries across 3 backends; 9 SQLite rows; duplicate replay acknowledged; mismatch/collision cases rejected; outboxes drained.

Runtime/release limitations:
- Android JavaScript bundle export is not proof of an installable APK or device runtime.
- No iOS runtime artifact or simulator/device proof is present in this run.
- No artifacts were attached to this latest run.
- Therefore Android APK runtime and iOS runtime remain NOT VERIFIED by this evidence.

Dependency audit signals in retrieved logs:
- Mobile dependency install: 5 moderate vulnerabilities.
- Web dependency install in interoperability job: 4 vulnerabilities (2 moderate, 2 high).
- Desktop dependency install: 11 vulnerabilities (8 moderate, 3 high).
- These are separate dependency roots and should not be summed as unique vulnerabilities without deduplication.
- Severity/package/advisory-level triage was not available in the inspected summary lines. Treat dependency remediation as a release blocker pending full `npm audit --json` review and disposition.
- GitHub Actions logs warn that actions still targeting Node.js 20 are being forced to run on Node.js 24; update/verify action compatibility.

**Dependency gate: FAIL (non-zero reported vulnerabilities; high-severity findings in Web/Desktop require triage).**  
**Runtime artifact gate: NOT VERIFIED.**

## 6. Consolidated status register

| Gate / control | Status | Reason |
|---|---|---|
| GH-05 disposable RLS cases | PASS | 34/34 fixture cases |
| GH-05 identity provenance | NOT VERIFIED | App SQL role can set custom tenant/user context |
| GH-05 production RLS | BLOCKED | Production grants/policies/runtime not proven |
| GH-06 synthetic relational parity | PASS | 25/25 fixture cases |
| GH-06 synthetic temporal/concurrency | PASS | 4/4 fixture cases |
| GH-06 canonical schema/migration parity | NOT VERIFIED | Full canonical DDL/migration history not tested |
| DEC-008 | BLOCKED | Canonical schema and authorization parity outstanding |
| GH-08 evidence package | BLOCKED | Independent approvals and single-SHA artifact reconciliation outstanding |
| GH-09 disposable API context tests | PASS | 13/13 harness cases |
| RLS-016 | BLOCKED | Production API not integrated with PostgreSQL identity/pool context |
| SEC-02 production route matrix | NOT VERIFIED | Harness-only evidence; complete production matrix outstanding |
| POOL-01 multi-connection lifecycle | NOT VERIFIED | Pool size one only |
| Latest Mobile CI verify | PASS | Job success; 119 tests passed, 0 failed |
| Latest interoperability CI | PASS | Synthetic three-backend sync passed |
| Dependency security gate | FAIL | Non-zero findings, including high severity in Web/Desktop roots |
| Android APK runtime | NOT VERIFIED | JS bundle is not APK/device runtime evidence |
| iOS runtime | NOT VERIFIED | No iOS runtime proof in latest run |
| Independent Security review | BLOCKED | Reviewer not appointed/approval absent |
| Independent Database review | BLOCKED | Reviewer not appointed/approval absent |
| Schema Freeze | BLOCKED | Not approved |

## 7. Open governance blockers

- [Issue #124 — P0 Schema Design Review](https://github.com/muchlisbstg/export-client-mobile-sync/issues/124): OPEN. Missing transaction-party bridge and tenant-scoped composite constraint design decisions require independent Database review.
- [Issue #125 — P0 Security Review](https://github.com/muchlisbstg/export-client-mobile-sync/issues/125): OPEN. Independent Security reviewer has not been appointed.
- DEC-006: OPEN.
- DEC-007: PARTIALLY EVIDENCED.
- DEC-008: OPEN.
- RLS-016: BLOCKED.
- Schema Freeze: NOT APPROVED.

## 8. Ordered remediation plan

1. Appoint independent Security and Database reviewers; record identities and review independence.
2. Resolve transaction-party domain representation and all tenant/transaction/site composite-FK decisions in an ADR and ERD.
3. Complete read-only inventory of the actual runtime database, migration ledger, schema objects, constraints, ownership, roles, and policy fingerprints.
4. Resolve identity provenance and production RLS boundary; do not rely on caller-settable custom GUCs as trusted identity.
5. Integrate verified identity and least-privilege membership resolution into the authoritative API.
6. Run GH-09/POOL-01 against the actual server and multi-connection pool.
7. Expand SEC-02 to the complete production route/resource matrix and denied-write immutability.
8. Run GH-06 against canonical DDL and reconciled migrations on both PostgreSQL and SQLite.
9. Triage dependency advisories across Web, Mobile, and Desktop; remediate or formally disposition each finding.
10. Generate Android APK and iOS runtime evidence, with exact SHA provenance and install/launch evidence.
11. Rerun all gates on one pinned candidate SHA, attach logs/artifacts/digests, and complete GH-08 independent sign-offs.
12. Reassess branch protection and required status checks before any merge decision.

## 9. Change-control statement

This report is committed only to the dedicated audit branch. No changes were made to `main`. No merge, deployment, migration, DDL, seed, backfill, staging/production database mutation, or reviewer approval was performed or inferred.

**Final decision: P0 RELEASE READINESS = BLOCKED.**
