# Mobile build and release readiness

## Android preview APK

The `.github/workflows/android-preview-apk.yml` workflow is the first device-testing gate. It regenerates and commits the Expo dependency lockfile on the pull-request branch, runs `npm ci`, tests, typecheck, Expo compatibility, Android JavaScript export, Expo Prebuild, and Gradle `assembleDebug`. The resulting debug APK is uploaded as a 14-day workflow artifact.

A debug APK is for internal installation and smoke testing only. It is not a production-signed release package.

## Android AAB release gate

Before producing a release AAB:

- Confirm the permanent Android application ID: `com.muchlisbstg.exportclient`.
- Approve the production signing-key ownership and backup/recovery procedure.
- Store signing material only in restricted GitHub Actions secrets or an approved signing service; never commit keystores or passwords.
- Configure a release build profile and verify versionCode/versionName policy.
- Validate release build, signature, install/upgrade path, permissions, network security, and API environment.
- Require security, privacy, legal, operational, and Syariah approvals before public distribution.

No production keystore or signing secret is created by this repository workflow.

## iOS IPA release gate

Before producing an IPA:

- Select and approve a permanent iOS bundle identifier; the current `app.json` does not define one.
- Confirm Apple Developer Organization membership and the legal entity's authority to enroll.
- Use a macOS build runner.
- Configure signing certificates, provisioning profiles, and App Store Connect credentials through restricted secrets or an approved managed build service.
- Verify iOS privacy declarations, export-compliance answers, permissions, and device compatibility.
- Require the same release approvals as Android before TestFlight or App Store submission.

## Governance

Build artifacts are not production releases. No workflow in this repository may submit to an app store, deploy a production backend, or publish a public release without explicit human approval.
## Dependency integrity

`package.json` and `package-lock.json` must describe the same Expo SDK compatibility matrix. CI must run `npm ci` against the committed lockfile; it must not silently resolve a different dependency graph for a release build.
