# Release Evidence Register

**Repository:** muchlisbstg/export-client-mobile-sync  
**Main baseline at refresh:** `3112b6a12e53870a62b5ffd82967f504351d37b2`  
**Status:** Evidence snapshot 2026-11-07. This register is not an approval or release authorization.

## Gate register

| Gate | Status | Evidence and remaining work |
|---|---|---|
| Security P0 | BLOCKED | Existing negative/regression workflow passed, but endpoint matrix, positive-path coverage, audit-write failure injection, role revocation, exhaustive read/mutation cross-site coverage and independent Security Review remain outstanding. |
| Database model | BLOCKED | PR #121 design packet is now present on main. Formal Database Review decision is absent; GitHub review state observed was COMMENTED, not APPROVED. Decide counterparty model, bridge key, buyer/seller membership enforcement, four dependent composite FKs, NULL-site policy and engine-specific design. |
| Physical staging schema | EMPTY / NOT RUNTIME-VERIFIED | Read-only Supabase identity: project `export-client-staging`, ref `utvxuzmtevnmrcpxfpaa`, region `ap-south-1`, PostgreSQL `17.11.0.011`, status `ACTIVE_HEALTHY`; `public` tables = 0; migration history = 0. This does not prove the API process uses this project. |
| Schema prototype | NOT_STARTED — REVIEW GATED | Existing in-memory SQLite contract test is read-only and confirms the five blockers are present. Build the proposed bridge/composite-FK prototype only after formal Database Review, in disposable isolated SQLite and PostgreSQL environments. |
| Android | IN_PROGRESS | PR #121 head `d7c5d4504687681a3fc0f2d374165206d0310fb3`: npm ci, tests, typecheck, Expo compatibility, Android bundle export and native prebuild passed; APK build remained in progress when inspected. Run `42315988204`; release matrix Android job in run `42315988179` also in progress. Need APK artifact, logs and functional login/API/session/business-flow test. |
| iOS | IN_PROGRESS | Same PR #121 head: npm ci, Expo compatibility and native prebuild passed; Simulator build was in progress when inspected. Run `42315988220`; release matrix iOS job in run `42315988179` also in progress. Need completed Simulator build/install/launch and login/API/session validation. |
| Web | PARTIAL | Web static export passed in run `42315988217`; artifact `expo-web-dist` uploaded. Release matrix Web export also passed in run `42315988179`. Browser login/session/CORS E2E is not evidenced. Existing `test/p0-cors-preflight.test.mjs` is a Node HTTP preflight test, not a real-browser test. |
| Expo SDK 58 | PARTIAL | Expo dependency compatibility checks passed on the PR #121 candidate across Android, iOS and Web workflows. This is not a substitute for native build/launch or browser runtime acceptance. |
| Dependency audit | BLOCKED — FINDINGS | Fresh `npm audit` artifact ID `13550881204`, run `42315988204`, Node `v22.23.4`, npm `10.9.9`; exit code 1; 5 moderate, 0 high, 0 critical. Affected packages: `expo`, `@expo/cli`, `@expo/fingerprint`, `glob`, `minimatch`. Automated suggested fix downgrades Expo to `53.0.11`; do not apply because it is a major downgrade from SDK 58. Review a compatible remediation and re-run audit. |
| Legal | BLOCKED | Qualified jurisdiction-specific review of actual export and financial transaction flows is not recorded. |
| Sharia | BLOCKED | Qualified Sharia review of parties, akad, ownership/possession, risk, fees, settlement, refunds/default and money flow is not recorded. Financial flows remain disabled/demo-only. |
| Release | BLOCKED | Security, Database, Android, iOS, Web, Legal and Sharia gates plus release owner approval remain mandatory. |

## Candidate and workflow provenance

The platform/schema evidence above was generated from PR #121:
- PR head SHA: `d7c5d4504687681a3fc0f2d374165206d0310fb3`
- GitHub pull-request synthetic merge SHA: `33806a09a4d7f05a71bf7ef40663434da500e662`
- Schema contract run `42315988230`: SUCCESS. The test asserts schema inspection is read-only and that all five integrity blockers are still reported.
- Mobile CI run `42315988216`: SUCCESS for API client/typecheck/Expo compatibility and interoperability jobs.
- Web export run `42315988217`: SUCCESS; static export artifact uploaded.
- Android Preview run `42315988204`: IN_PROGRESS at APK build when last inspected.
- iOS Simulator run `42315988220`: IN_PROGRESS at Simulator build when last inspected.
- Release matrix run `42315988179`: negative/regression, Expo compatibility/fresh audit and Web export jobs passed; Android and iOS jobs remained in progress.

GitHub Actions PR workflows execute against a synthetic merge ref. Record both PR head SHA and workflow merge SHA; do not describe a run as testing a different commit.

## Physical schema inspection provenance

- Supabase project discovery and project detail were read-only.
- Confirmed target project identity: `export-client-staging`, ref `utvxuzmtevnmrcpxfpaa`, region `ap-south-1`, PostgreSQL `17.11.0.011`.
- Public schema inventory: zero tables. Migration history: zero entries.
- No SQL was executed, no migration was created/applied, and no staging/production schema or data was changed.
- The API process entrypoint, runtime working directory, effective database path/project and active environment have not been tied to this Supabase project. The actual runtime physical schema therefore remains unverified.
- Do not apply any application migration to this empty staging project.

## Governance event requiring audit

GitHub main now contains merge commits for PR #120 and PR #121. The assistant did not invoke a merge action. Confirm the actual actor and authorization from GitHub audit/PR timeline before treating those merges as compliant with the prior no-merge instruction. This register does not infer who performed them.

## Review decision register

| Gate | Status | Approval evidence required |
|---|---|---|
| Database | PENDING | Formal APPROVED review with counterparty, bridge key, membership enforcement, FK, NULL-site and engine-specific rationale |
| Security | PENDING | Independent APPROVED review against complete endpoint matrix and test evidence |
| Legal | PENDING | Qualified reviewer, jurisdictions, transaction spec version, decision and conditions |
| Sharia | PENDING | Qualified Sharia advisor/board, akad/money-flow spec version, decision and conditions |
| Platform | PENDING | Exact-candidate build plus runtime functional tests for each platform |
| Release | BLOCKED | All applicable approvals and explicit release owner decision |

## Evidence record requirements

Record gate, acceptance criterion, repository, branch, exact head SHA, workflow merge SHA if applicable, run/job, artifact ID and digest, runtime, command, timestamp, reviewer authority and formal decision, open risks, owner and mitigation.

A green CI check is not an independent Security, Database, Legal, Sharia, platform-runtime or release approval. Any mandatory BLOCKED, FAILED, NOT_STARTED, missing approval, unresolved high-risk finding or candidate-SHA mismatch blocks release.
