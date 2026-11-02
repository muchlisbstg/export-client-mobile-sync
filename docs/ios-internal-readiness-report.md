# iOS Internal Readiness Report

## Scope and decision

- Distribution target: internal development and simulator testing only.
- Apple Developer Program: not required for unsigned iOS Simulator builds; enrollment, signing, IPA distribution, and TestFlight remain deferred.
- Expo SDK: preserve `~58.0.22`; no downgrade or broad forced remediation.
- Candidate bundle identifier: `com.muchlisbstg.exportclient` (not registered or verified for ownership).
- Build target: unsigned iOS Simulator application, not an installable signed IPA for physical iPhones.

## Repository evidence

- Main merge commit for PR #90: `2c87dc14108784c49eca7343772392949bd93106`.
- Follow-up branch: `fix/ios-simulator-swift-6-2`.
- Follow-up PR: #91 (Draft; manual review and merge required).
- Tested branch commit: `9d8de92786b2b8295dd00c240e8fe7102ac8f969`.
- GitHub Actions PR merge-checkout SHA for the tested run: `51bc3c95c62d626cbd31745240b7ead89d0f6d1c`.

PR #90 was merged on GitHub at 2026-11-02T01:50:09Z. This report does not attribute that merge to automation by this assistant. No merge, deployment, or main-branch write was performed while preparing this update.

## CI and native build

### iOS Simulator Build — PASS

- Workflow run #4: `41375101452`.
- Job: `Build unsigned iOS Simulator app` — completed successfully.
- Checkout: PR #91 merge checkout containing branch commit `9d8de92786b2b8295dd00c240e8fe7102ac8f969` and base main commit `2c87dc14108784c49eca7343772392949bd93106`.
- Runner: macOS 26.6.2, arm64.
- Xcode: Xcode 26.6 (build 17F113); iOS Simulator SDK 26.5.
- Expo dependency compatibility check: passed.
- iOS native prebuild: passed.
- CocoaPods installation: passed.
- Xcode compile: **`BUILD SUCCEEDED`**.
- Simulator build architectures: arm64 and x86_64.
- App bundle: `ExportClient.app`.
- Bundle ID: `com.muchlisbstg.exportclient`.
- Version: `0.1.0`; build number: `1`.
- Minimum iOS deployment target: `16.4`.
- Device family: iPhone and iPad.
- Platform: `iphonesimulator`; no embedded provisioning profile and no app-level code-signature directory. The build was configured with code signing disabled.
- Uploaded artifact ID: `13111610100`, archive size 32,590,971 bytes, SHA-256 `647901dfa20fab8b40fe7ba48cc1324a9fd29569be68a261f751c2c1207f189f`.
- Artifact contains `ios-simulator-app.zip`, which contains `ExportClient.app`.

The artifact was downloaded and inspected. Its Info.plist values and universal Mach-O architectures match the simulator target. This confirms successful compilation and packaging, but does not prove the app has been launched or functionally accepted in an interactive simulator session.

### Mobile CI — PASS

- Workflow run #602: `41375101450`.
- `verify` job: passed.
  - Application/API test suite: 89 passed, 0 failed.
  - TypeScript typecheck: passed.
  - Expo dependency compatibility: passed.
  - Android JavaScript bundle export: passed.
- `interoperability` job: passed.
  - Three synthetic inquiries created across three actual backend databases.
  - Nine total SQLite rows (three per database).
  - Origin IDs preserved.
  - Three duplicate replays acknowledged.
  - Three record mismatches and three tracking-code collisions rejected without overwrite.
  - All outboxes drained; six conflict records recorded.

These are automated test and backend interoperability results, not interactive iOS UI acceptance.

### Android Preview APK — PASS

- Workflow run #25: `41375101529`.
- Job: `Validate app and build installable Android preview APK` — passed.
- Application tests, typecheck, Expo compatibility, JavaScript export, native project generation, and Gradle `assembleDebug` all passed.
- APK artifact ID: `13110483888`.
- APK size: 143,289,283 bytes.
- APK SHA-256: `7f5118cdc1c37a43b85fe7d301ec00cf283cae6a0cb65a4ef17116d5e1fa5a44`.
- This is a debug preview APK. A successful CI build does not establish installation or runtime acceptance on a physical Android device.

## Dependency audit

The npm audit artifact from the Android Preview workflow reports:

- Audit timestamp: 2026-11-02T01:57:23Z.
- Node.js: v22.23.4; npm: 10.9.9 (audit capture environment).
- 11 moderate vulnerabilities; 0 low, 0 high, 0 critical.
- Audit exit code: 1.
- Findings include affected Expo transitive packages, glob (`GHSA-3g3m-2fjr-6pw4`) and minimatch (`GHSA-g3hv-75wg-m249`).
- The broad Expo remediation path proposes Expo `53.0.11`, which would downgrade this project from SDK 58. That is not an acceptable automatic remediation.

The application package manifest on the tested branch declares Expo `~58.0.22`. Expo SDK 58 is preserved. No `npm audit fix --force`, SDK downgrade, or unreviewed override was applied. Dependency remediation remains an open, separate task: identify compatible patched transitive versions, validate Expo SDK compatibility, and rerun tests and native builds before proposing a PR.

## Functional test evidence and remaining acceptance

| Area | Automated evidence | Actual iOS UI / live environment |
|---|---|---|
| Login | Backend auth tests cover missing/invalid tokens, provider outage, verified identity, admin authorization, and enterprise role authorization. | Not yet exercised end-to-end in iOS Simulator; requires a configured Supabase test environment and dedicated test account. |
| Catalog | API contract tests cover catalog retrieval; filtering, sorting, comparison, CSV and share helpers are in the 89-test suite. | Not yet manually exercised in iOS Simulator. Current product list is demo data. |
| Inquiry | Client tests cover POST payload and tracking; server tests cover create, persistence, validation and tracking. | Not yet submitted through the running iOS app against a dedicated test backend. |
| Synchronization | Backend tests cover sync authentication, disabled-by-default behavior, persistent outbox retry after restart, three-node forwarding and duplicate echo suppression. The three-backend interoperability job passed. | Not yet verified from the iOS app against live peer nodes. App UI currently displays local peer-sync status and supports refresh; it does not expose a manual sync operation. |

## Readiness decision

**Status: NATIVE SIMULATOR BUILD READY; END-TO-END IOS ACCEPTANCE PENDING.**

The corrected macOS 26 / Xcode 26.6 simulator build compiled successfully and the unsigned universal simulator app artifact was uploaded and inspected. Mobile CI and Android Preview are green on the same tested branch commit. The dependency audit still reports 11 moderate vulnerabilities, with no high or critical findings; compatible remediation is outstanding.

### Remaining gates

1. Launch the `.app` in an iOS Simulator and record boot, install, launch, and runtime logs.
2. Run login using a dedicated Supabase test account.
3. Load catalog from a controlled test backend and verify empty/error/loading states.
4. Submit and track a non-production inquiry.
5. Configure two or more test peer nodes and verify replication, retry, duplicate suppression, and conflict visibility.
6. Record screenshots, logs, test data identifiers, and exact commit SHA.
7. Address moderate dependency findings through a compatible SDK 58 remediation branch and rerun CI.

## Distribution policy

Do not enroll in Apple Developer Program, create signing credentials, build a signed IPA, or submit to TestFlight until external distribution is explicitly required and the seller/legal entity decision is resolved. Internal simulator validation remains the current target.
