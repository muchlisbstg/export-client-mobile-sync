# Release Evidence Register

**Repository:** muchlisbstg/export-client-mobile-sync  
**Baseline main SHA:** `9e02871971fde07a5e9c2271960c4e35f3c2b49d`  
**Active validation candidate:** PR #121 head `d7c5d4504687681a3fc0f2d374165206d0310fb3`  
**GitHub PR validation merge commit:** `33806a09a4d7f05a71bf7ef40663434da500e662`  
**Status:** Evidence snapshot for 2026-11-07. This register does not grant gate approval.

## Gate register

| Gate | Status | Current evidence | Remaining requirement |
|---|---|---|---|
| Security P0 | BLOCKED | PR #119 and existing negative/regression workflow coverage | Complete route × method × role × enterprise × site matrix; positive paths; audit-write failure injection; role revocation; exhaustive read/mutation cross-site coverage; independent Security Review. |
| Database schema | BLOCKED | PR #121; schema contract run `42315988230` passed on the PR validation merge commit | Five source-level blockers remain by design. Formal Database Review decision is absent; current PR review state is COMMENTED, not APPROVED. |
| Physical staging schema | BLOCKED / EMPTY | Supabase project `export-client-staging`, ref `utvxuzmtevnmrcpxfpaa`, region `ap-south-1`, PostgreSQL `17.11.0.011`, status `ACTIVE_HEALTHY`; public schema contains 0 tables; migration history contains 0 entries | This proves the inspected staging project identity, not the runtime DB used by the API. Do not run app migrations against this empty project. |
| Isolated schema prototype | NOT_STARTED — approval gated | Existing synthetic contract test uses in-memory SQLite and confirms inspection is read-only | Wait for explicit Database Review decision on counterparty model, party key, membership enforcement, four composite FKs, NULL-site policy and engine strategy. Then build/test only in disposable isolated SQLite and PostgreSQL environments. |
| Android | IN_PROGRESS | Run `42315988204` on PR #121 head: npm ci, tests, typecheck, Expo compatibility, Android bundle export and native prebuild passed; debug APK build still in progress. Release matrix run `42315988179` Android job also in progress. | Complete APK build/upload; inspect artifact and logs; emulator/device functional login, API, session and business workflow validation. |
| iOS | IN_PROGRESS | Run `42315988220` on PR #121 head: npm ci, Expo compatibility and iOS prebuild passed; CocoaPods install in progress. Release matrix run `42315988179` iOS job also in progress. | Complete Simulator build, install, launch and smoke evidence; login/session/API functional validation. |
| Web | PARTIAL | Expo Web export run `42315988217` passed and uploaded artifact `expo-web-dist`; release matrix Web job in run `42315988179` passed. | No real-browser login/session/CORS E2E evidence found. Existing `test/p0-cors-preflight.test.mjs` is a Node HTTP preflight contract test, not browser E2E. Add browser-based coverage and verify auth token/session propagation, configured/untrusted origins, API calls and refresh/routing. |
| Expo SDK 58 | PARTIAL / PASS FOR COMPATIBILITY CHECK | PR #121 Android, iOS and Web workflows completed `npx expo install --check` successfully. Release matrix SDK compatibility job passed. | Native build/launch and browser runtime gates remain separate; compatibility check alone is not platform approval. |
| Dependency audit | BLOCKED — findings present | Fresh `npm audit` artifact from run `42315988204`, artifact ID `13550881204`; Node `v22.23.4`, npm `10.9.9`; audit exit code 1; 5 moderate, 0 high, 0 critical. Packages: `expo`, `@expo/cli`, `@expo/fingerprint`, `glob`, `minimatch`. | Review advisories and determine a compatible remediation for Expo SDK 58. npm's suggested fix downgrades Expo to `53.0.11` (major downgrade); do not apply that automated fix. Re-run audit after an approved compatible change. |
| Legal | BLOCKED | Governance review template exists | Qualified jurisdiction-specific reviewer must review actual transaction and export/payment flows; record scope, evidence, decision and conditions. |
| Sharia | BLOCKED | Governance review template exists | Qualified Sharia advisor/board must review parties, akad, ownership/possession, risk, fees, settlement, refund/default and actual money flow. Financial flows remain disabled/demo-only. |
| Release approval | BLOCKED | Evidence register and deployment blueprint exist | All applicable technical and independent reviews, Legal & Sharia approvals, exact-SHA evidence and named release owner approval are required. |

## Current GitHub workflow evidence

All following PR #121 workflows identify head branch `database/schema-reconciliation-review-2026-11-07` and head SHA `d7c5d4504687681a3fc0f2d374165206d0310fb3`. GitHub Actions for pull requests executes against synthetic merge commit `33806a09a4d7f05a71bf7ef40663434da500e662`; do not confuse that merge test ref with the branch head.

| Run ID | Workflow | Observed result |
|---|---|---|
| 42315988230 | P0 Schema Reconciliation Contract | SUCCESS — read-only contract test and tenant/supply-chain regression tests passed; five blockers intentionally remain detected. |
| 42315988216 | Mobile CI | SUCCESS — interoperability and API client/typecheck/Expo compatibility checks passed. |
| 42315988217 | Expo Web Build | SUCCESS — SDK compatibility, tests, typecheck and static export passed; artifact uploaded. |
| 42315988204 | Android Preview APK | IN_PROGRESS at debug APK build when inspected. npm audit report uploaded. |
| 42315988220 | iOS Simulator Build | IN_PROGRESS at CocoaPods installation when inspected. |
| 42315988179 | Release Readiness Matrix | IN_PROGRESS; negative/regression tests, SDK compatibility/fresh audit and Web export jobs passed; Android and iOS jobs still running. |

## Database inspection provenance and limits

- Read-only Supabase project discovery and project detail were used to establish project identity.
- The selected staging project is `export-client-staging`, project ref `utvxuzmtevnmrcpxfpaa`, region `ap-south-1`, PostgreSQL `17.11.0.011`.
- Read-only inventory returned no tables in `public` and no migration history entries.
- No SQL was executed, no migration was created/applied, and no staging or production data/schema was changed.
- The connected project inventory also contains another project; the inspected staging project must not be confused with that separate project.
- The API's actual runtime database identity/path has not been established from process/runtime evidence. Therefore the empty staging inventory cannot be represented as proof of the API's effective physical schema.

## Review decisions

| Review | Current state | Decision owner / evidence required |
|---|---|---|
| Database model and composite FK | PENDING | Formal Database Review against PR #121; COMMENTED text saying "Approved" is not a GitHub APPROVED decision. |
| Security | PENDING | Independent Security Review against complete endpoint matrix and candidate SHA. |
| Legal | PENDING | Qualified reviewer and jurisdiction-specific decision record. |
| Sharia | PENDING | Qualified Sharia advisor/board decision record. |
| Release | BLOCKED | Named release owner must approve only after all applicable gates pass. |

## Evidence record format

For every new evidence item, record:
- gate and acceptance criterion;
- repository, branch, exact head SHA and, for PR workflows, synthetic merge SHA;
- workflow/run URL, job name and conclusion;
- artifact name, immutable artifact/run ID and digest;
- test command, runtime version, result and timestamp;
- reviewer identity, authority, formal decision, conditions and timestamp;
- open findings, owner, risk, mitigation and expiry.

Never copy a green check from another commit and present it as evidence for the current candidate.

## Release decision rule

The release state is the strictest applicable gate, not an average. Any mandatory BLOCKED, FAILED, NOT_STARTED, missing reviewer, unresolved high-risk finding, or mismatched candidate SHA blocks release. A successful CI run does not itself approve Security, Database, Legal, Sharia, platform runtime, or release readiness.
