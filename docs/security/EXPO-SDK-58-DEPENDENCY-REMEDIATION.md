# Expo SDK 58 Dependency Remediation — Technical Evidence Pack

**Status:** Investigation and compatibility plan; dependency changes not yet applied  
**Repository:** `muchlisbstg/export-client-mobile-sync`  
**Work branch:** `security/dependency-remediation-expo-sdk-58`  
**Baseline main SHA:** `3c1140e04aaaa79be79351a2b043fd678fb86866`

## Current locked dependency evidence

The branch lockfile is identical to main at the time of inspection.

| Package | Locked version | Relevant dependency path / constraint |
|---|---:|---|
| `expo` | 58.0.23 | SDK 58 |
| `expo/node_modules/@expo/cli` | 58.1.19 | Depends on `glob ^13.0.0` |
| `@expo/fingerprint` | 0.21.9 | Declares `glob ^13.0.0` and `minimatch ^10.2.2` |
| `glob` | 13.0.6 | Depends on `minimatch ^10.2.2` |
| `minimatch` | 10.2.6 | Vulnerable version |

Root application pins remain Expo `~58.0.23`, React `19.3.0`, React Native `0.88.1`, and the SDK 58 web runtime packages.

## Advisory assessment

- **GHSA-3g3m-2fjr-6pw4 / CVE-2026-118773:** glob versions 9.0.0 through 14.0.1 are affected; fixed in 14.0.2. The issue concerns cancellation/AbortSignal not stopping background filesystem traversal.
- **GHSA-g3hv-75wg-m249 / CVE-2026-118764:** minimatch versions below 11.0.1 are affected; fixed in 11.0.1. The issue concerns attacker-influenced glob pattern amplification and CPU/memory consumption.
- Both are Moderate availability/resource-consumption advisories. They are transitive build/tooling dependencies in the current lockfile; assess the actual production installation graph with a fresh audit before assigning runtime exposure.

## SDK compatibility constraint

Expo SDK 58's current dependency ranges constrain `glob` to major 13 and `@expo/fingerprint` constrains `minimatch` to major 10. These ranges cannot naturally resolve to the advisory fixed majors. Upstream Expo issue #52735 discusses this SDK 58 pin conflict and override-based remediation. The upstream issue is open at the time of research.

## Remediation strategy

Do not run `npm audit fix --force`, do not downgrade Expo, and do not apply blanket overrides without compatibility evidence.

Candidate isolated experiment only:

- Override `glob` to `>=14.0.2`.
- Override `minimatch` to `>=11.0.1`.
- Inspect the resulting dependency graph, including any nested copies under Expo CLI and fingerprint packages.
- Verify whether SDK 58's consumers rely on behavior changes between glob 13/14 or minimatch 10/11.

The experiment must remain on this dependency branch and be reverted if SDK CLI, fingerprinting, Metro, prebuild, or export compatibility regresses.

## Required validation gate

1. Reproduce current `npm audit --json` against the exact lockfile in a clean environment; record Node/npm versions and audit timestamp.
2. Record `npm ls glob minimatch @expo/cli @expo/fingerprint` before and after.
3. Confirm all resolved copies are at or above fixed versions; no vulnerable nested copies remain.
4. Run `npm ci`, `npm audit`, `npm run typecheck`, and `npm test`.
5. Run `npx expo config --type public` and Expo dependency validation.
6. Run `npx expo export --platform web` and inspect output.
7. Run iOS/Android prebuild and CI build checks where supported; verify Hermes, Metro, native module compatibility, and app startup.
8. Compare lockfile changes and ensure no unrelated dependency churn.
9. Re-run audit on the exact final commit SHA.

## Current disposition

- No package or lockfile change has been made.
- The current advisory findings remain open pending a fresh audit and compatibility experiment.
- No Expo downgrade or force-fix is approved.
- Reviewer sign-off is pending; no reviewer has been appointed.


## Isolated override experiment — 2026-11-04

An ephemeral GitHub Actions experiment was run from branch `experiment/expo58-glob-minimatch-overrides` at commit `cd8aa797d3543e5b1ffca0db46b28ad1330abcc0`. The experiment changed dependency overrides only inside the CI runner; it did not commit changes to the dependency PR's `package.json` or `package-lock.json`.

| Package | Baseline resolved | Isolated candidate | Advisory fixed threshold |
|---|---:|---:|---:|
| `glob` | 13.0.6 | 14.0.3 | 14.0.2 |
| `minimatch` | 10.2.6 | 11.0.4 | 11.0.1 |

Audit results from the exact experiment artifact:

| Audit scope | Baseline | Candidate |
|---|---:|---:|
| Full tree | 5 moderate; 0 high/critical | 0 advisories |
| Production-only | 5 moderate; 0 high/critical | 0 advisories |

The candidate retained Expo `58.0.23`, `@expo/cli` `58.1.19`, and `@expo/fingerprint` `0.21.9`; only the resolved glob/minimatch transitive versions moved. CI compatibility checks completed successfully: 107/107 tests, TypeScript typecheck, `npx expo install --check`, and Android JavaScript bundle export. The evidence artifact is available from [experiment run 41782625947](https://github.com/muchlisbstg/export-client-mobile-sync/actions/runs/41782625947).

A follow-up experiment run adds iOS and Android native prebuild generation checks to the ephemeral runner. These results are pending. This is not yet sufficient evidence for adopting overrides: native compilation, simulator/device runtime, and full end-to-end validation must also pass. Do not merge the overrides or modify the committed lockfile until the follow-up checks and independent dependency review are complete.
