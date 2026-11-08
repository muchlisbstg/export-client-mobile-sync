# P0 stale PR supersession audit — #118 and #119

**Current main baseline:** `79bf932b85b5e7bc618a42de8feb6565061ef869` (2026-11-08; PR #132 merge commit).  
**Audit type:** documentation-only reconciliation of historical PR scope against current main.  
**Disposition:** PR #118 and PR #119 are both **closed, not merged**. Their functional/documentation deltas are represented by later mainline work; neither old branch should be reopened, merged, or cherry-picked merely to recover those changes.

## Verified PR state and replacement sequence

| PR | State | Merge status | Current disposition |
|---|---|---|---|
| #118 — CORS authorization, schema reconciliation, deployment blueprint | Closed | Not merged | Superseded by later mainline files and tests |
| #119 — route authorization remediation and CORS contract | Closed | Not merged | Superseded by later mainline files and tests |
| #128 — schema ADR, browser CORS E2E, audit failure injection | Closed | Merged; `812200a92cd503a7287b3cf8208578e9d7abf65f` | Carries forward P0 matrix, schema inventory, browser CORS test, representative audit-failure injection |
| #129 — ADR P0-001 alignment | Closed | Merged; `b4caeb1893625fce08341a82f2bb0f72dbff7e2b` | Follow-on domain/schema alignment |
| #130 — remaining P0 verification gates | Closed | Merged; `3cc1165aa62549a860140af9fd35e89acd72592a` | Verification-gate documentation |
| #131 — release authorization OpenAPI 3.1 | Closed | Merged; `0ac102e9c292283190660ac05ca2ea49ccd72eac` | Separate API contract work; does not freeze Domain Service Design |
| #132 — export sale akad framework | Closed | Merged; `79bf932b85b5e7bc618a42de8feb6565061ef869` | File remains explicitly DRAFT / NOT APPROVED; merge does not approve an akad or contract |

## PR #118 — file-level reconciliation

All **8 of 8 changed paths** from #118 are represented on the inspected mainline:

| Changed path | Mainline disposition |
|---|---|
| `.github/workflows/ios-simulator-build.yml` | Superseded/extended workflow path filters are present |
| `docs/deployment-blueprint.md` | Later budget-gated deployment blueprint is present |
| `docs/p0-api-endpoint-authorization-matrix.md` | Current matrix is present; its evidence wording and historical status are corrected separately |
| `docs/p0-schema-reconciliation-remediation.md` | Schema blocker inventory and remediation record are present; blockers are not thereby resolved |
| `package.json` | CORS and P0 test scripts are represented in the current test command |
| `server/index.mjs` | Strict CORS middleware is present in mainline |
| `test/p0-cors-preflight.test.mjs` | Dedicated synthetic preflight tests are present |
| `test/p0-endpoint-auth-matrix.test.mjs` | Endpoint authentication and negative CORS assertions are present |

**Conclusion for #118:** no unique source/test path requires cherry-picking from its closed branch. Presence of these paths is not proof that every security acceptance gate is complete.

## PR #119 — file-level reconciliation

All **9 of 9 changed paths** from #119 are represented on the inspected mainline:

| Changed path | Mainline disposition |
|---|---|
| `App.tsx` | Current app health presentation is represented |
| `docs/p0-api-endpoint-authorization-matrix.md` | Current matrix is present; evidence wording and historical PR state are corrected separately |
| `server/index.mjs` | Current route registration and authorization implementation are represented; duplicate legacy transaction GET registrations were removed |
| `src/api-core.ts` | Minimal health response contract is represented |
| `test/api.test.mjs` | Health contract test is represented |
| `test/p0-cross-site-route-matrix.test.mjs` | Cross-site authorization and denied-write coverage is represented |
| `test/p0-endpoint-auth-matrix.test.mjs` | Endpoint authentication and CORS assertions are represented |
| `test/p0-role-enterprise-site.test.mjs` | Eight-role denial and evidence entity-role coverage is represented |
| `test/transaction-authorization.test.mjs` | Transaction assignment, site-link, grant/revoke, and access checks are represented |

**Conclusion for #119:** no unique source/test path requires cherry-picking from its closed branch. Existing positive-path tests are representative, not exhaustive for every allowed role × resource × site × state combination.

## CORS and security evidence qualification

PR #128 added `test/p0-browser-cors.e2e.mjs` and the `P0 Browser Security E2E` workflow. On exact candidate head `824e37cd1047158e00a7b17c9aa6762462a39c72`, workflow run `42439061375` completed successfully. The test uses real Chromium to:
- issue a cross-origin fetch with non-safelisted `X-Request-Id`, forcing browser-managed preflight;
- verify the actual allowed-origin `GET /health` response and exact `Access-Control-Allow-Origin`;
- verify a hostile origin cannot read the API response.

This is real-browser evidence for that bounded test, not proof of authenticated Web application flows, all protected routes, all method/header combinations, or every platform/browser.

## Current open gates — not closed by supersession

- Complete positive-path authorization coverage for every applicable role and route/resource family.
- Exhaustive audit-persistence failure injection for every mutation.
- Enterprise-role revocation behavior across all affected route families.
- PostgreSQL composite-FK and RLS integration under the least-privilege application role.
- Independent Security and Database reviews against exact SHAs.
- Exact-current-main verification for all required Android, iOS Simulator, Web, and API gates.
- Domain/legal decisions and approval required for schema implementation and release.
- Separate governance review of PR #132: it was merged, but its contract framework remains explicitly marked DRAFT / NOT APPROVED.

## Final disposition

1. Keep PR #118 and #119 closed and unmerged.
2. Do not reopen, merge, or cherry-pick their stale branches merely to recover already represented paths.
3. Treat the file-level path reconciliation as complete for the inspected main baseline `79bf932b85b5e7bc618a42de8feb6565061ef869`.
4. Keep P0 Security and release readiness **OPEN** until the outstanding evidence and independent reviews above are completed.
5. Any future code or documentation correction must use a new isolated branch and PR; human review and merge remain separate decisions.

**Safety boundary:** this audit is documentation and source-history reconciliation only. It does not authorize DDL, migration, application changes, database access, merge, deployment, contract finalization, or release.
