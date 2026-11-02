# iOS Internal Readiness Report

## Scope and decision

- Distribution target: internal development and simulator testing only.
- Apple Developer Program: not required for unsigned iOS Simulator builds; enrollment and TestFlight are deferred.
- Expo SDK: preserve `~58.0.22`; no downgrade.
- Candidate bundle identifier: `com.muchlisbstg.exportclient` (not yet registered or verified for ownership).
- Build target: unsigned iOS Simulator application; not an IPA for physical iPhones.

## Repository evidence

- Main merge commit for PR #90: `2c87dc14108784c49eca7343772392949bd93106`.
- Follow-up simulator toolchain branch: `fix/ios-simulator-swift-6-2`.
- Follow-up PR: #91 (Draft; manual review/merge required).
- Follow-up commit: `2cbfb4ce394a266a57918df3b78c2e5a5e1f09ae`.

PR #90 was merged on GitHub at 2026-11-02T01:50:09Z. This report does not attribute that merge to automation by this assistant.

## CI and native build

### Verified

- Mobile CI run #598 (`41374790410`): `verify` and `interoperability` jobs completed successfully.
- Test suite: 89 passed, 0 failed.
- TypeScript typecheck: passed.
- Expo SDK dependency compatibility check: passed.
- Android JavaScript export: passed.
- Three-backend interoperability (web/mobile/desktop): passed.
- iOS Prebuild Validation run #3 (`41374259904`): passed.
- In the first iOS Simulator attempt (`41374259980`), `npm ci`, Expo compatibility, iOS prebuild, and CocoaPods installation passed.

### Failed first simulator compilation

The first Xcode compile failed because the macOS 15 runner selected Xcode 16.4 / Swift 6.1, while a resolved Apple Swift package declares Swift tools version 6.2.0.

Follow-up PR #91 changes the simulator-only runner to `macos-26`, increases the timeout, and excludes the Pods workspace when locating the application workspace. This is a toolchain/CI correction; no JavaScript dependencies or lockfiles were changed.

- Follow-up simulator workflow run #2: `41374790396`.
- Latest observed status: run #2 passed CocoaPods installation and is in progress at Xcode Simulator compilation; packaging and artifact upload have not yet completed.
- Therefore simulator compilation is **not yet verified**.

## Dependency audit

The captured npm audit artifact reports:

- 531 dependency nodes.
- 11 moderate vulnerabilities.
- 0 high vulnerabilities.
- 0 critical vulnerabilities.
- Main advisories include glob `GHSA-3g3m-2fjr-6pw4` and minimatch `GHSA-g3hv-75wg-m249`.

The audit's broad automatic remediation path proposes Expo 53.0.11, which would downgrade the project from Expo SDK 58. That remediation is rejected by project policy. No downgrade or unverified override was applied. The dependency findings remain open for a compatible, separately tested remediation.

## Functional test evidence

| Area | Automated evidence | Actual iOS UI / live environment |
|---|---|---|
| Login | Backend auth tests cover missing/invalid tokens, provider outage, verified identity, and admin authorization; enterprise role authorization tests pass. | Not yet exercised end-to-end in iOS Simulator; requires configured Supabase test environment and test account. |
| Catalog | API contract tests cover catalog retrieval; catalog filtering, sorting, comparison, CSV and share helpers are in the 89-test suite. | Not yet manually exercised in iOS Simulator. Current product list is demo data. |
| Inquiry | Client tests cover POST payload and tracking; server tests cover create, persistence, validation and tracking. | Not yet submitted through the running iOS app against a dedicated test backend. |
| Synchronization | Server tests cover sync authentication, disabled-by-default behavior, persistent outbox retry after restart, three-node forwarding, duplicate echo suppression; web/mobile/desktop interoperability CI passes. | Not yet verified from the iOS app against live peer nodes. App UI currently displays local peer-sync status and supports refresh; it does not itself expose a manual sync operation. |

## Readiness decision

**Status: NOT READY for end-to-end iOS acceptance yet.**

The code-level test and interoperability gates are green. The native prebuild is green. The first simulator compile failed due to a Swift toolchain mismatch, and the corrected macOS 26 simulator build remains pending.

### Remaining gates

1. Confirm PR #91 simulator workflow completes Xcode compilation and uploads the `.app` artifact.
2. Inspect the artifact and verify bundle ID, build version, simulator architecture, and absence of signing requirements.
3. Launch the app in an iOS Simulator and perform UI smoke tests.
4. Run login using a dedicated Supabase test account.
5. Load catalog from a controlled test backend.
6. Submit and track a non-production inquiry.
7. Configure two or more test peer nodes and verify replication, retry, and conflict visibility.
8. Record screenshots, logs, test data identifiers, and exact commit SHA.

## Distribution policy

Do not enroll in Apple Developer Program, create signing credentials, build a signed IPA, or submit to TestFlight until external distribution is explicitly required. Internal simulator validation remains the current target.
