# Mobile build and release readiness

## Android preview APK

The `.github/workflows/android-preview-apk.yml` workflow validates the committed dependency graph with `npm ci`, runs tests, typecheck, Expo compatibility, Android JavaScript export, Expo Prebuild, and Gradle `assembleDebug`. The committed `package-lock.json` is preserved as a workflow artifact for traceability, and the resulting debug APK is uploaded as a 14-day workflow artifact.

The workflow is read-only with respect to repository contents. Dependency updates must be generated, reviewed, and committed in a pull request; CI must not silently rewrite or push a lockfile. A debug APK is for internal installation and smoke testing only. It is not a production-signed release package.

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

`package.json` and `package-lock.json` must describe the same Expo SDK compatibility matrix. CI runs `npm ci` against the committed lockfile and fails if the lockfile does not match the manifest. Any dependency change must update both files in the same reviewed pull request.

## Physical Android device testing

The current Android API fallback `http://10.0.2.2:4001` is intended for the Android emulator host bridge, not a physical handset. Before testing API-backed flows on a phone, build with `EXPO_PUBLIC_API_URL` set to a reachable API origin (prefer HTTPS) and configure the required Supabase public client settings. Do not treat a successful APK installation as proof of backend connectivity.
