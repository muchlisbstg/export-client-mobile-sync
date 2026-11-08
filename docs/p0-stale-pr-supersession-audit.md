# P0 stale PR supersession audit — #118 and #119

**Main baseline inspected:** `b9bb1e010b443ec449e698d4e8a8409fd8286d47`  
**Current reconciliation Draft PR:** #128, branch `security/p0-schema-browser-audit-gates-2026-11-08`  
**Disposition:** do not close #118 or #119 yet. Close as superseded only after #128 is merged and every carried-forward document/test is verified on the resulting main SHA.

## PR #118 — CORS and release/schema documentation

| Changed path in #118 | Reconciliation evidence | Disposition |
|---|---|---|
| `.github/workflows/ios-simulator-build.yml` | Main includes `server/**` and `test/**` filters through PR #127. | Superseded on main |
| `docs/deployment-blueprint.md` | Main contains a budget-gated deployment blueprint with API/PostgreSQL/object-storage topology, no-budget model, release/security gates, and Indonesia/legal/Syariah safeguards. It is a later/superset document, not a byte-identical cherry-pick. | Superseded on main |
| `docs/p0-api-endpoint-authorization-matrix.md` | The CORS and detailed authorization review matrix is being carried into PR #128. | Pending PR #128 |
| `docs/p0-schema-reconciliation-remediation.md` | The source-level table/relationship inventory and five-blocker reconciliation are being carried into PR #128. | Pending PR #128 |
| `package.json` | Main test script already includes `test/p0-cors-preflight.test.mjs`; PR #128 adds audit-failure injection to the suite. | Superseded on main / extended in #128 |
| `server/index.mjs` | Exact-origin allowlist, method/header allowlists, strict preflight rejection, Vary, and max-age behavior are present on main from PR #126. | Superseded on main |
| `test/p0-cors-preflight.test.mjs` | Allowed and denied origin/method/header tests are present on main and run through `npm test`. | Superseded on main |
| `test/p0-endpoint-auth-matrix.test.mjs` | Minimal health and CORS negative assertions are present in the current P0 test baseline. | Superseded on main |

## PR #119 — authorization remediation and health contract

| Changed path in #119 | Reconciliation evidence | Disposition |
|---|---|---|
| `App.tsx` | Main uses minimal API liveness status and no longer renders peer topology/queue/retry/conflict metrics. | Superseded on main |
| `docs/p0-api-endpoint-authorization-matrix.md` | Detailed role-denial matrix, route inventory, reviewer checklist, and open positive-path/audit gaps are being carried into PR #128. | Pending PR #128 |
| `server/index.mjs` | Duplicate legacy transaction GET registrations were removed; assignment-aware transaction routes are authoritative. CORS implementation is reconciled from #118. | Superseded on main |
| `src/api-core.ts` | `ApiHealth` uses only `status: "ok"`; client no longer requires internal sync details. | Superseded on main |
| `test/api.test.mjs` | Minimal public liveness contract test is present in the current test baseline. | Superseded on main |
| `test/p0-cross-site-route-matrix.test.mjs` | Source/destination authorization and denied handover side-effect coverage are present in the current test baseline. | Superseded on main |
| `test/p0-endpoint-auth-matrix.test.mjs` | DELETE/PATCH CORS preflight and protected endpoint auth cases are present in the current baseline. | Superseded on main |
| `test/p0-role-enterprise-site.test.mjs` | Eight-role denial matrix and evidence entity × role matrix are present in the current baseline. | Superseded on main |
| `test/transaction-authorization.test.mjs` | Positive transaction reads for all eight roles, admin grant/site-link/revoke, and revocation behavior are present in the current baseline. | Superseded on main |

## Important qualification

“Superseded on main” means the functional source/test change is present in the inspected main baseline; it does not mean the stale PR itself was merged. The remaining documentation deltas are in PR #128 and must be merged/re-read before either source PR is closed.

PR #118 and #119 still report open with `mergeable: false`; their base/head SHAs are stale relative to current main. Do not resolve their conflicts by merging either old branch. Do not close them before PR #128's carried-forward documentation is accepted.

## Closure procedure after PR #128

1. Re-read #128's final head SHA and merge commit after human approval.
2. Fetch each mapped file from main and verify the exact content/behavior again.
3. Confirm no unique changed path or semantic change remains in either #118 or #119.
4. Add a final comment to both PRs pointing to #128 and the verified main SHA.
5. Close #118 and #119 with reason **completed/superseded** only after that verification.
6. Keep P0 OPEN until schema/domain approval, independent database/security review, browser CORS E2E, complete positive-path and audit-failure coverage, PostgreSQL FK/RLS integration, and platform build gates are complete.

No PR was closed by this audit. No merge, deployment, database access, DDL, or migration is authorized.
