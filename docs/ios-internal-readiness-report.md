# iOS Internal Readiness Report

**Review date:** 3 November 2026  
**Repository:** `muchlisbstg/export-client-mobile-sync`  
**Reviewed main SHA:** `d4a267489986a4f4e2aab2c2e4a4ae3ddd24456e`

## Scope and distribution decision

- Target remains internal development and iOS Simulator validation.
- The workflow builds an unsigned Simulator `.app`; it is not an IPA and is not installable on a physical iPhone.
- Apple Developer signing, TestFlight, and App Store distribution remain out of scope.
- Preserve Expo SDK `~58.0.22`; no SDK downgrade is authorized.
- Candidate bundle identifier `com.muchlisbstg.exportclient` is not evidence of registered ownership or a verified signing identity.

## Repository and PR evidence

- PR #90 established the initial iOS Simulator workflow.
- PR #91, `ci(ios): build simulator with Swift 6.2 toolchain`, was merged on 2 November 2026 at `2026-11-02T02:01:23Z`.
- PR #91 head SHA: `9d8de92786b2b8295dd00c240e8fe7102ac8f969`.
- PR #91 merge commit: `1afcf59a5140a5a544361ae010330ed34aa3e8cb`.
- The change moved the simulator-only job to a Swift 6.2-capable macOS runner, increased the timeout, and avoided selecting the Pods workspace. It did not change JavaScript dependencies or the lockfile.

## Latest verified GitHub Actions evidence

The following runs were queried for the PR #91 head SHA `9d8de92786b2b8295dd00c240e8fe7102ac8f969`:

| Workflow | Run ID | Result |
|---|---:|---|
| Mobile CI | `41375101450` | Success |
| Android Preview APK | `41375101529` | Success |
| iOS Simulator Build | `41375101452` | Success |

The iOS job, **Build unsigned iOS Simulator app**, completed successfully through dependency installation, Expo compatibility validation, native project generation, CocoaPods installation, Xcode Simulator compilation, app packaging, and artifact upload.

### iOS Simulator artifact

- Artifact: `ios-simulator-51bc3c95c62d626cbd31745240b7ead89d0f6d1c`
- Artifact ID: `13111610100`
- Size: 32,590,971 bytes
- Expiration: `2026-11-09T02:06:06Z`
- [Workflow run and artifact](https://github.com/muchlisbstg/export-client-mobile-sync/actions/runs/41375101452)

**Evidence boundary:** GitHub reports that the artifact was uploaded. The artifact binary has not been downloaded and inspected in this review. Bundle identifier, app version, architecture, and launch behavior are therefore not independently certified here.

## Functional validation status

| Area | Automated evidence | Actual iOS UI / live environment |
|---|---|---|
| Authentication | Backend auth and enterprise authorization tests are included in the repository test suite. | Not yet exercised end-to-end in the Simulator with a dedicated Supabase staging account. |
| Catalog | API and catalog helper tests are included. | Not yet manually exercised in the Simulator against a controlled backend. |
| Inquiry | Client/server tests cover request and tracking behavior. | Not yet submitted and tracked through the running iOS app against a dedicated test API. |
| Supply-chain operations | Supply-chain service and route tests are included. | Not yet validated through the iOS UI against a configured staging environment. |
| Peer synchronization | Mobile/web/desktop interoperability CI has passed. | Live iOS-to-peer replication, retry, and conflict behavior remain unverified. |

## Readiness decision

**Status: BUILD VERIFIED — END-TO-END ACCEPTANCE PENDING.**

The corrected iOS Simulator workflow compiled, packaged, and uploaded an unsigned app artifact. This closes the previous Swift toolchain build blocker. It does not establish that the app has been launched, that backend connectivity works, or that the business workflows pass in the Simulator.

### Remaining acceptance gates

1. Download and inspect the exact artifact while it is still available; record its SHA-256 and verify app metadata.
2. Launch it in a compatible iOS Simulator and capture a successful startup screenshot and logs.
3. Configure a dedicated Supabase staging identity and test API origin; do not use production credentials.
4. Exercise login, catalog loading, inquiry submission, and tracking against synthetic staging data.
5. Exercise supply-chain screens and role-denied cases using test identities.
6. Configure at least two test peer nodes and verify replication, retry, duplicate suppression, and conflict visibility.
7. Record screenshots, redacted logs, synthetic test identifiers, exact artifact ID, workflow run, and source SHA.

## Distribution policy

Do not create signing credentials, enroll in Apple Developer Program, produce a signed IPA, or submit to TestFlight until external distribution is explicitly approved. A successful unsigned Simulator build is an internal engineering milestone, not a production release.
