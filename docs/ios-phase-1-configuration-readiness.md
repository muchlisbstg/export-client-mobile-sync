# iOS Phase 1 — Configuration & Native Build Readiness

**Status:** Planning/audit only. No iOS build has been run or certified by this document.  
**Base:** `main` at `a80aeb674db2836aba28c2a160a42fa55ec2269c`  
**Scope:** Establish the evidence and decisions required before the first reproducible iOS native build.  
**SDK policy:** Preserve Expo SDK 58. Do not downgrade Expo, React Native, or regenerate the lockfile as an incidental part of this phase.

## 1. Evidence-based baseline

The repository manifest currently declares:

- Expo `~58.0.22`
- React `19.3.0`
- React Native `0.88.1`
- npm scripts `ios: expo start --ios` and `typecheck: tsc --noEmit`
- `app.json` includes `ios.supportsTablet: true`, but no `ios.bundleIdentifier` or iOS build number.
- The root `eas.json` file is not present on the inspected `main` ref.
- Android package identifier is `com.muchlisbstg.exportclient`; this is not an iOS bundle identifier.

These facts establish a configuration gap, not a failed or successful iOS build. The `expo start --ios` script starts the Expo development workflow; it does not prove that a signed IPA can be built.

## 2. Decisions required before configuration

Do not invent or commit the following values:

1. **iOS Bundle Identifier** — owner-approved reverse-DNS identifier, unique in the Apple Developer account.
2. **Apple Developer team** — account/team that owns signing and App Store Connect distribution.
3. **Application display name** — confirm whether the iOS display name remains `Export Client`.
4. **Supported devices** — confirm iPhone and iPad support; current config says tablet support is enabled.
5. **Minimum iOS deployment target** — select based on Expo SDK 58 / React Native 0.88 support and the intended device fleet; verify against generated native project and official compatibility requirements before pinning.
6. **Permission usage descriptions** — add only for native capabilities actually used (camera, photo library, location, notifications, etc.). Never add generic descriptions for unused capabilities.
7. **Distribution channel** — internal development build, ad hoc, TestFlight, or App Store. These have different signing and provisioning requirements.

## 3. Phase 1 work packages

### P1.1 — Configuration inventory

- Inspect all Expo config sources (app.json/app.config.*), plugins, assets, environment variables, and native modules.
- Identify modules that require iOS permission strings or native configuration.
- Confirm whether the project uses managed/prebuild workflow or committed native `ios/` project.
- Verify whether any native-only package has an iOS implementation and supported version for SDK 58.
- Keep secrets and signing credentials out of repository files and Expo public environment variables.

### P1.2 — Configuration proposal

After owner decisions are supplied:

- Add `ios.bundleIdentifier`.
- Define version/build-number strategy and increment policy.
- Add only evidenced permission descriptions and required config plugins.
- Define explicit build profiles in `eas.json` only if EAS is the selected build service.
- Keep local and CI environment variables separated; document names, never values.
- Do not commit certificates, provisioning profiles, API keys, or Apple credentials.

### P1.3 — Native prebuild validation

- Run dependency installation with the committed lockfile using `npm ci`.
- Run the repository test suite and `npm run typecheck`.
- Run Expo dependency compatibility checks for SDK 58.
- Run `npx expo prebuild --platform ios --no-install` in an isolated working copy after configuration is approved.
- Review generated iOS project changes for unexpected permissions, entitlements, URL schemes, associated domains, background modes, and build settings.
- Do not commit generated native files unless the repository's native-project strategy explicitly requires them.

### P1.4 — Build readiness

- Select a supported macOS/Xcode build environment or approved EAS Build workflow.
- Verify Xcode version and SDK compatibility with Expo SDK 58 and React Native 0.88.
- Configure Apple signing through the selected secure credential workflow.
- Build a development IPA first; do not submit to TestFlight/App Store during this phase.
- Record build URL/run ID, source commit SHA, toolchain versions, artifact checksum, and signing identity metadata (never private key material).

## 4. Required acceptance gates

| Gate | Required evidence | Exit condition |
|---|---|---|
| Manifest | Expo config inspection | Bundle ID and app identity approved |
| Dependencies | `npm ci`, lockfile unchanged | Reproducible install |
| Tests | Full repository test suite | All tests pass |
| Type safety | `npm run typecheck` | Pass |
| Expo compatibility | SDK 58 dependency validation | No unresolved incompatibility |
| iOS prebuild | Isolated iOS prebuild log and diff | Completes; native diff reviewed |
| Native configuration | Permission/entitlement review | No unexplained capability or permission |
| iOS build | Signed development IPA | Build succeeds on supported toolchain |
| Artifact provenance | SHA, run/build ID, checksum | Artifact tied to exact source commit |

A successful Android build does not satisfy any iOS-specific gate. A prebuild success does not prove signing or IPA distribution.

## 5. Out of scope for Phase 1

- TestFlight upload or external testing.
- App Store submission, metadata, screenshots, privacy nutrition labels, and review.
- Production API rollout or real customer data.
- Changes to `main`, deployment, or release publication.
- Expo SDK downgrade or broad dependency overrides.
- Assuming that legal, export, privacy, or Syariah review has been completed.

## 6. Risks and controls

- **Identity collision / wrong publisher:** bundle ID and Apple team must be explicitly confirmed by the repository owner.
- **Unnecessary permissions:** permission strings must map to actual app features and native modules.
- **SDK drift:** retain SDK 58 and use the committed lockfile; investigate compatibility rather than downgrading.
- **Credential exposure:** use secure CI/EAS credentials; never commit signing files or secrets.
- **False readiness:** distinguish Expo development launch, prebuild, signed IPA, TestFlight, and App Store approval as separate milestones.
- **Native project drift:** inspect generated diffs and decide whether `ios/` is generated transiently or committed as source.

## 7. Next action / owner inputs

Before implementing manifest changes, the owner must confirm:

- Approved iOS bundle identifier.
- Apple Developer team/account availability (yes/no; do not share credentials).
- Preferred build route: EAS Build or macOS/Xcode CI.
- Whether camera, photo library, location, push notifications, or other native permissions are actually required by the current mobile feature set.

Until these decisions are confirmed, this branch intentionally contains planning documentation only. No production configuration has been guessed or changed.
