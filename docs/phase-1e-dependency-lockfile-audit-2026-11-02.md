# Phase 1E — Dependency & Lockfile Audit

**Review update:** 3 November 2026  
**Repository:** `muchlisbstg/export-client-mobile-sync`  
**Reviewed main SHA:** `d4a267489986a4f4e2aab2c2e4a4ae3ddd24456e`

## 1. Executive status

| Control | Verified state | Assessment |
|---|---|---|
| Expo dependency baseline | `expo ~58.0.22`, React `19.3.0`, React Native `0.88.1` | Preserved |
| Committed lockfile | `package-lock.json` exists on main | Present |
| Reproducible install | Android Preview uses `npm ci --no-audit` | Locked install; audit intentionally separate |
| Workflow permissions | Android Preview uses read-only repository permission and does not persist checkout credentials | Hardened |
| Historical npm audit | Candidate SHA `824a5087e2804a3d76051deaa69e74a2b997cd49` reported 11 moderate package findings | Historical evidence only |
| Latest candidate audit artifact | Android Preview run `41580926337` uploaded an `npm-audit-...` artifact | Artifact existence verified; JSON contents not re-read in this review |
| Current main dependency graph | No newly downloaded `npm audit --json` report tied to reviewed main SHA was inspected here | Current severity not certified |
| Production release | Preview/debug build only | Not a production release gate |

**Important correction:** the historical 11-moderate result is real evidence for its recorded candidate dependency graph. It must not be described as a fresh audit of the current main SHA unless the manifest/lockfile checksums match or a new audit is run against that exact SHA. Conversely, the opening statement that no audit report had ever been found was too broad and is superseded by the historical artifact evidence below.

## 2. Dependency manifest baseline

The reviewed repository manifest declares:

### Runtime dependencies

| Package | Declared version |
|---|---|
| `expo` | `~58.0.22` |
| `react` | `19.3.0` |
| `react-native` | `0.88.1` |
| `better-sqlite3` | `^13.0.3` |
| `express` | `^5.3.0` |
| `@expo/metro-runtime` | `~58.0.16` |
| `react-dom` | `19.3.0` |
| `react-native-web` | `~0.21.4` |

Development dependencies include `@types/express` `^5.0.6`, `@types/react` `~19.3.0`, and `typescript` `~6.0.3`. The manifest also contains an npm override for `uuid` `^11.1.1`.

Declared ranges are not the resolved graph. Review `package.json` and `package-lock.json` together for any candidate change.

## 3. Lockfile and workflow controls

- PR #82 synchronized the Expo manifest and npm lockfile; it merged at `9db00cd3e02e606b1fe4f3edfce739504f963cfb`.
- PR #83 hardened Android Preview: `contents: read`, `persist-credentials: false`, and no workflow-side lockfile rewrite/push.
- The Android Preview workflow runs `npm ci --no-audit`. The `--no-audit` flag means this workflow validates installation/build against the committed lockfile but does not produce a vulnerability audit.
- Dependency remediation must be made in a reviewed branch with manifest and lockfile changes together. CI must not silently rewrite or push dependency changes.

## 4. Historical npm audit evidence

A full `npm audit --json` artifact was captured on a candidate workflow:

- Workflow run: [41368487390 — Android Preview APK](https://github.com/muchlisbstg/export-client-mobile-sync/actions/runs/41368487390)
- Artifact: `npm-audit-824a5087e2804a3d76051deaa69e74a2b997cd49`
- Artifact ID: `13108555694`
- Candidate SHA: `824a5087e2804a3d76051deaa69e74a2b997cd49`
- Base SHA: `fdbc6a1f55d7048b9780014aa3a28965d7ee2cbe`
- Node/npm: `v22.23.4` / `10.9.9`
- Audit timestamp: `2026-11-02T00:41:39Z`
- Recorded `package.json` SHA-256: `99a64c95ed0d5db0fd74605faf8e11d5da0fb850d6b930e4cd88c489574d627e`
- Recorded `package-lock.json` SHA-256: `ad82e377a2a4d0cb7b54f6da4f16b1a8e9e8ed7ced355c4c1bf291046a498b87`
- npm audit exit code: `1`; stderr was empty.

### Historical severity summary

| Severity | Count |
|---|---:|
| Info | 0 |
| Low | 0 |
| Moderate | **11** |
| High | 0 |
| Critical | 0 |

The artifact metadata reported 531 dependency nodes. The 11 affected package nodes were reported across Expo tooling, `glob`, and `minimatch`. The two underlying advisories recorded in that report were:

- [GHSA-3g3m-2fjr-6pw4 — glob](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4)
- [GHSA-g3hv-75wg-m249 — minimatch](https://github.com/advisories/GHSA-g3hv-75wg-m249)

These are historical findings for the checksummed candidate above, not a claim about the current main dependency graph.

## 5. Latest artifact boundary

The Android Preview run `41580926337` is recorded as uploading an artifact named `npm-audit-0795f66e97c1644a1f4e5852fb47444090f57e32` (artifact ID `13205871598`). The artifact listing confirms its existence and size, but its JSON payload was not inspected as part of this documentation update. No severity counts are inferred from its filename or size.

## 6. Remediation policy

- Do not run blanket `npm audit fix` against the project.
- Do not downgrade Expo SDK 58 to satisfy an automatic major-version remediation.
- Re-run `npm audit --json` against the exact candidate SHA and record Node/npm versions, manifest/lockfile checksums, exit code, artifact ID, and timestamp.
- Evaluate compatible patch/minor updates or carefully scoped overrides on a dedicated branch.
- Require Expo compatibility, unit tests, typecheck, Web export, Android Preview, and iOS Simulator validation on the same candidate SHA before accepting dependency changes.
- Record accepted, mitigated, and deferred advisories with rationale and owner.

## 7. Closure criteria

- [ ] Fresh audit JSON is tied to the exact candidate SHA and matching manifest/lockfile checksums.
- [ ] Each finding has a severity, dependency path, advisory, remediation option, and disposition.
- [ ] Any dependency/override change is tested on a separate branch without SDK downgrade.
- [ ] All relevant CI workflows pass on the exact remediation SHA.
- [ ] A human reviewer accepts any remaining risk before release.

**Current decision:** dependency audit evidence is partially established, but current-main vulnerability status and remediation are not closed. Do not represent the current graph as vulnerability-free.
