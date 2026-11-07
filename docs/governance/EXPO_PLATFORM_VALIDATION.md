# Expo Platform Validation

**Gate:** Android, iOS, and Web are independent release targets. Evidence for one target cannot substitute for another.

## Required evidence matrix

| Area | Android | iOS | Web |
|---|---|---|---|
| Dependency/SDK compatibility | Separate result | Separate result | Separate result |
| Production-equivalent build/export | Android build artifact/log | iOS build artifact/log | Web export/build artifact/log |
| Runtime smoke test | Emulator and/or physical device | Simulator and/or physical device | Supported browser |
| Authentication/session | Tested | Tested | Tested |
| API origin/configuration | Verified | Verified | Verified |
| Navigation/deep links | Applicable tests | Applicable tests | Routing/history tests |
| Platform-specific behavior | Native modules, permissions, share, storage | Native modules, permissions, share, storage | Browser APIs, file/share fallback |
| Regression/accessibility | Evidence | Evidence | Evidence |
| CI run and candidate SHA | Recorded | Recorded | Recorded |

## Platform-specific checks

### Android
- Verify Expo SDK and native dependency compatibility.
- Build the intended variant and inspect build logs/artifact.
- Test authentication, network/API configuration, navigation, permissions, offline/retry behavior, and native integrations on a supported emulator or device.
- Record device/OS, build identifier, commit SHA, and results.

### iOS
- Verify iOS-specific native dependency compatibility independently.
- Build for the intended iOS target and inspect logs/artifact.
- Test on iOS Simulator and, when required by native behavior, a physical device.
- Verify authentication, API origin, navigation, permissions, sharing, storage, and native integrations.
- Record simulator/device and OS version, build identifier, commit SHA, and results.

### Web
- Verify React Native Web, Expo web runtime, DOM dependencies, browser-compatible APIs, and web bundler configuration.
- Build/export the web target and run browser smoke/regression tests.
- Verify routing, refresh/deep links, authentication/session, CORS/API origin, storage, file upload/download, and browser fallbacks for native-only APIs.
- Record browser/version, build identifier, commit SHA, and results.

## Gate semantics

Each platform status is independently one of `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `FAILED`, or `APPROVED`. `APPROVED` requires build evidence and runtime tests tied to the same candidate SHA. A platform not in scope must be explicitly excluded by a human product/release owner with rationale; it must not be silently treated as passed.
