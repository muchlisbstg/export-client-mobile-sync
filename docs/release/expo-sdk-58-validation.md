# Expo SDK 58 Compatibility and Build Evidence

**Date:** 2026-11-04  
**Repository:** `muchlisbstg/export-client-mobile-sync`  
**Merged baseline:** `main` at `73e75edad71c5a6f8819e80c5ffdeabf32314c3d`  
**Status:** SDK compatibility checks pass in CI; final branch-specific native/Web build validation is pending.

## Locked application stack

| Package | Declared version |
|---|---|
| `expo` | `~58.0.23` |
| `react-native` | `0.88.1` |
| `react` / `react-dom` | `19.3.0` |
| `@expo/metro-runtime` | `~58.0.17` |
| `react-native-web` | `~0.21.4` |
| `typescript` | `~6.0.3` |

The project uses Metro for Expo Web and has explicit Android/iOS bundle identifiers. The committed lockfile is used by CI with `npm ci`; workflows verify that the lockfile is not modified during installation.

## Existing CI evidence

| Validation | Run / commit | Result | Evidence boundary |
|---|---|---|---|
| Mobile CI on merged main | [41782801995](https://github.com/muchlisbstg/export-client-mobile-sync/actions/runs/41782801995), SHA `73e75ed` | Passed | Tests, typecheck, Expo dependency compatibility, Android JS export, three-backend interoperability |
| Mobile CI on Expo dependency branch | [41782983101](https://github.com/muchlisbstg/export-client-mobile-sync/actions/runs/41782983101), SHA `0adfad6` | Passed | Tests, typecheck, Expo compatibility, Android JS export, three-backend interoperability |
| Android debug preview APK | [41782702538](https://github.com/muchlisbstg/export-client-mobile-sync/actions/runs/41782702538), SHA `2e3f082` | Passed | Debug APK artifact uploaded; not a signed Play Store release |
| iOS Simulator build and launch | [41782702720](https://github.com/muchlisbstg/export-client-mobile-sync/actions/runs/41782702720), SHA `2e3f082` | Passed | Unsigned Simulator app installed/launched; not an App Store archive |
| iOS native prebuild | [41782702662](https://github.com/muchlisbstg/export-client-mobile-sync/actions/runs/41782702662), SHA `2e3f082` | Passed | Generated Xcode project validated |
| Expo Web static export | [41782702444](https://github.com/muchlisbstg/export-client-mobile-sync/actions/runs/41782702444), SHA `2e3f082` | Passed | `dist/` artifact uploaded; not deployed to hosting |

The native Android, iOS Simulator, and Web artifacts above were generated on the PR head before the final SDK dependency merge. The merged `main` SHA subsequently passed Mobile CI and Expo compatibility checks, but native/Web validation must be repeated against the final release-readiness branch SHA. This branch adds push-triggered artifact-only workflows so those validations can run without opening a PR or triggering a hosting preview.

## Dependency audit — separate open item

The dependency audit on the SDK 58 branch reported **5 moderate vulnerabilities**:

- `glob@13.0.6`
- `minimatch@10.2.6`

An isolated CI experiment with temporary overrides:

- `glob: ^14.0.2`
- `minimatch: ^11.0.1`

resolved to `glob@14.0.3` and `minimatch@11.0.4`, and its candidate audit reported **0 vulnerabilities**. The experiment artifact contains the generated candidate `package.json` and `package-lock.json`; those overrides are not accepted in the committed dependency graph yet. Do not represent the audit as clean until the candidate lockfile is reviewed, committed on a branch, and all compatibility/build gates pass.

## Acceptance criteria for this branch

- [ ] `npm ci` uses the committed lockfile without modifying it.
- [ ] `npm test` and `npm run typecheck` pass.
- [ ] `npx expo install --check` passes.
- [ ] Android JS export and debug APK build pass.
- [ ] iOS prebuild, unsigned Simulator build, install, and launch smoke pass.
- [ ] Expo Web static export passes and produces `dist/`.
- [ ] Three-backend interoperability remains green.
- [ ] Audit findings are explicitly triaged; no automatic major SDK downgrade or blanket `npm audit fix`.

## Release limitation

These validations establish buildability and smoke-test behavior, not production readiness. Code signing, physical-device E2E, store submission, API deployment, runtime configuration, production data, and final human release approval remain separate gates.
