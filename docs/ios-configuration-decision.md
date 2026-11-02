# iOS Configuration Decision Record

**Branch:** `ios/phase-1-native-config`  
**Base:** `main` at `a80aeb674db2836aba28c2a160a42fa55ec2269c`  
**Policy:** Expo SDK 58 remains unchanged.

## Decisions implemented

| Decision | Value | Rationale / status |
|---|---|---|
| iOS bundle identifier | `com.muchlisbstg.exportclient` | Candidate aligned with the existing Android application ID. Must be confirmed available/owned in the Apple Developer account before signing or distribution. |
| Build service | EAS Build | Cloud build route selected to avoid requiring a local macOS/Xcode workstation for routine builds. |
| Initial iOS build number | `1` | Initial baseline; EAS remote version management is configured for future builds. |
| iPad support | Enabled | Preserves the existing `ios.supportsTablet: true` setting. |
| Permission strings | None added | Current inspected `App.tsx` uses React Native UI and the platform Share API; no direct camera, photo library, location, or push-notification capability was evidenced. Reassess if native modules/features are added. |

## Files changed

- `app.json`: adds `ios.bundleIdentifier` and `ios.buildNumber`.
- `eas.json`: defines development, preview, and production build profiles; remote app version source.

## Remaining external setup

1. Confirm the candidate bundle identifier is available and registered to the correct Apple Developer team.
2. Run `eas login` and `eas init` from the repository checkout. This will associate the app with an EAS project and populate the EAS project ID; no project ID has been fabricated here.
3. Configure Apple signing through EAS Credentials using the authorized Apple Developer account. Do not commit certificates, private keys, provisioning profiles, or API keys.
4. Run `eas build --platform ios --profile preview` to create a signed internal preview build.
5. Verify artifact provenance and install on supported iOS devices before considering TestFlight.

## Build profiles

- `development`: development client, internal distribution.
- `preview`: internal distribution, suitable for the first signed device build.
- `production`: production distribution with EAS-managed build-number increment.
- `submit.production`: placeholder profile only; no TestFlight submission is configured or triggered.

## Explicitly not claimed

This configuration does not prove the bundle identifier is registered, Apple credentials are available, EAS project is initialized, native prebuild succeeds, a signed IPA exists, or TestFlight upload is possible. Those require account access and build evidence.
