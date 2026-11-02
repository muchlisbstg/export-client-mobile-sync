# Phase 1E — Dependency & Lockfile Audit

**Review date:** 2 November 2026  
**Scope:** Expo SDK 58 dependency manifest, committed npm lockfile, and Android Preview workflow  
**Repository:** `muchlisbstg/export-client-mobile-sync`  
**Base branch at review:** `main`

> **Evidence boundary:** This document records facts verified from the repository and GitHub pull-request metadata. It does not claim that an npm vulnerability audit has been completed. A complete `npm audit` JSON report and its matching command/runtime metadata were not found in the repository evidence reviewed for this change.

## 1. Executive status

| Control | Verified state | Assessment |
|---|---|---|
| Expo dependency manifest | `expo ~58.0.22`, `react 19.3.0`, `react-native 0.88.1` | Manifest baseline recorded |
| Lockfile committed | `package-lock.json` exists on `main`; blob SHA `0a70fe20b92e46c837fe17f60840e22c49fa0256` | Present |
| Lockfile synchronization PR | PR [#82](https://github.com/muchlisbstg/export-client-mobile-sync/pull/82) merged; merge commit `9db00cd3e02e606b1fe4f3edfce739504f963cfb` | Merged |
| CI install | Android Preview workflow runs `npm ci --no-audit` | Locked install is present; npm audit is explicitly skipped in this workflow |
| Workflow write scope | PR #83 merged at `a6870515955cb239ff669d939732e7ec0100d09c`; workflow uses `contents: read` and `persist-credentials: false` | Hardened |
| Read-only workflow | PR [#83](https://github.com/muchlisbstg/export-client-mobile-sync/pull/83) merged; Android Preview passed | Merged and build-verified |
| npm vulnerability findings | No matching `npm audit --json` evidence found in reviewed repository files | **Not verified** |
| Production release | Preview workflow builds a debug APK; no production signing or store submission | Not a production release gate |

## 2. Dependency manifest baseline

The current `package.json` on `main` declares:

### Runtime dependencies

| Package | Declared version |
|---|---|
| `expo` | `~58.0.22` |
| `react` | `19.3.0` |
| `react-native` | `0.88.1` |
| `better-sqlite3` | `^13.0.3` |
| `express` | `^5.3.0` |

### Development dependencies

| Package | Declared version |
|---|---|
| `@types/express` | `^5.0.6` |
| `@types/react` | `~19.3.0` |
| `typescript` | `~6.0.3` |

The manifest also declares an npm override for `uuid: ^11.1.1`. The committed lockfile is the resolved dependency graph and must be reviewed alongside the manifest; declared ranges alone do not establish the installed versions.

## 3. Lockfile change provenance

PR #82 states that the approved Expo dependency manifest had been merged without the corresponding regenerated `package-lock.json`. The PR regenerated the lockfile using:

```bash
npm install --package-lock-only --ignore-scripts --no-audit
```

It then required a committed lockfile and a clean `npm ci` install before the dependency work could pass its validation gate. PR #82 is now merged to `main` at merge commit:

```text
9db00cd3e02e606b1fe4f3edfce739504f963cfb
```

The current `main` branch contains `package-lock.json`. This establishes that the lockfile artifact is present; it does not, by itself, prove that every dependency is vulnerability-free or that the app is production-ready.

## 4. Android Preview workflow — current main behavior

The workflow at `.github/workflows/android-preview-apk.yml` on `main` now:

1. Runs on relevant pull-request path changes or manual dispatch.
2. Requests only `contents: read`.
3. Checks out with `persist-credentials: false`.
4. Preserves the committed lockfile as an artifact; it does not rewrite or push dependency changes.
5. Runs `npm ci --no-audit` against the committed graph.
6. Runs application tests, TypeScript typecheck, Expo compatibility check, Android JS export, Expo Prebuild, and Gradle `assembleDebug`.
7. Uploads the debug APK artifact with 14-day retention.

PR #83 merged at `a6870515955cb239ff669d939732e7ec0100d09c`. The PR's Android Preview workflow completed successfully. Its PR Mobile CI interoperability job had a failure, but the post-merge Mobile CI run on `main` completed both `verify` and `interoperability` successfully.

## 5. Workflow hardening proposal

PR #83 merged and implemented the following controls:

- Change workflow permission from `contents: write` to `contents: read`.
- Disable persisted checkout credentials.
- Remove workflow-side lockfile regeneration and push-back.
- Validate the reviewed committed dependency graph with `npm ci`.
- Keep the lockfile as a reviewed source-control artifact.

These controls are now present on `main`. The workflow permissions and Android Preview result were verified from the merged PR and its run.

## 6. npm vulnerability audit — captured evidence

<badge>Evidence captured</badge>

A full `npm audit --json` was captured from the Android Preview workflow on the reviewed candidate dependency graph.

| Evidence field | Value |
|---|---|
| GitHub Actions run | [#41368487390 — Android Preview APK](https://github.com/muchlisbstg/export-client-mobile-sync/actions/runs/41368487390) |
| Audit artifact | `npm-audit-824a5087e2804a3d76051deaa69e74a2b997cd49` (artifact ID `13108555694`) |
| Candidate workflow merge SHA | `824a5087e2804a3d76051deaa69e74a2b997cd49` |
| Base branch SHA | `fdbc6a1f55d7048b9780014aa3a28965d7ee2cbe` |
| Node.js / npm | `v22.23.4` / `10.9.9` |
| Audit timestamp | `2026-11-02T00:41:39Z` |
| package.json SHA-256 | `99a64c95ed0d5db0fd74605faf8e11d5da0fb850d6b930e4cd88c489574d627e` |
| package-lock.json SHA-256 | `ad82e377a2a4d0cb7b54f6da4f16b1a8e9e8ed7ced355c4c1bf291046a498b87` |
| npm audit exit code | `1` (findings present) |
| npm audit stderr | Empty |

### 6.1 Severity summary

| Severity | Count |
|---|---:|
| Info | 0 |
| Low | 0 |
| Moderate | **11** |
| High | **0** |
| Critical | **0** |
| **Total** | **11** |

npm reports 531 dependency nodes in the audit metadata: 500 production, 9 development, and 23 optional dependencies (peer and peer-optional counts are zero).

### 6.2 Affected package nodes

The 11 npm package findings in the committed lockfile are:

| Package | Locked version | Dependency classification | npm severity |
|---|---:|---|---|
| `@expo/cli` | `58.1.18` | Transitive | Moderate |
| `@expo/config` | `58.0.10` | Transitive | Moderate |
| `@expo/config-plugins` | `58.0.11` | Transitive | Moderate |
| `@expo/fingerprint` | `0.21.8` | Transitive | Moderate |
| `@expo/inline-modules` | `0.2.8` | Transitive | Moderate |
| `@expo/local-build-cache-provider` | `58.0.10` | Transitive | Moderate |
| `@expo/metro-config` | `58.0.20` | Transitive | Moderate |
| `@expo/prebuild-config` | `58.0.18` | Transitive | Moderate |
| `expo` | `58.0.22` | Direct | Moderate |
| `glob` | `13.0.6` | Transitive | Moderate |
| `minimatch` | `10.2.6` | Transitive | Moderate |

Only `expo` is a direct dependency in this list; the remaining 10 findings are transitive nodes in the Expo tooling/dependency graph. The npm count is a count of affected package nodes, not 11 distinct CVEs.

### 6.3 Underlying advisories

The JSON report identifies two underlying GitHub advisories:

1. [GHSA-3g3m-2fjr-6pw4 — glob AbortSignal cancellation bypass](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4). Reported affected range: `glob >=9.0.0 <=14.0.1`; locked `glob` version: `13.0.6`.
2. [GHSA-g3hv-75wg-m249 — minimatch globparts amplification DoS](https://github.com/advisories/GHSA-g3hv-75wg-m249). Reported affected range: `minimatch <11.0.1`; locked `minimatch` version: `10.2.6`.

These advisories propagate through the Expo dependency chain, which is why npm lists multiple affected Expo package nodes. Severity is moderate for all 11 package findings in this report.

### 6.4 Remediation decision

**Decision recorded for this candidate: do not run blanket `npm audit fix` and do not downgrade Expo.**

The audit's suggested automatic fix for the direct `expo` dependency is `expo@53.0.11`, marked as a SemVer-major change from the repository's Expo SDK 58 baseline (`expo ~58.0.22`). Applying that suggestion would move the project across an Expo SDK major version and is not an acceptable automatic security patch for this candidate.

Recommended remediation path:

- Investigate an Expo SDK 58-compatible patch/minor dependency resolution for `glob` and `minimatch`.
- Evaluate any npm override or transitive update in a dedicated feature branch; do not commit an override until Expo compatibility and native build tests pass.
- Preserve the Expo SDK 58 manifest baseline unless a separately reviewed SDK migration is approved.
- Re-run the exact audit and all quality gates after any dependency change, comparing the same manifest/lockfile SHA pair.
- If no compatible fix exists, record a temporary risk acceptance with accountable owner, rationale, controls, and a dated review deadline. No such acceptance is assumed by this report.

This is a documented recommendation, not an approved risk acceptance or a declaration that the vulnerabilities are harmless. Runtime exploitability and whether affected CLI/config packages ship in the app bundle require a separate dependency-path and build-output review.

### 6.5 Raw report

The raw `npm-audit.json`, stderr, exit code, and provenance metadata are retained together in the 30-day artifact linked above. The report is not committed to the public repository; the artifact preserves the full machine-readable evidence without publishing a separate copy in source control.


## 7. Decision and release gate

**Decision: HOLD on closing Phase 1E.** The npm audit report is now captured: 11 moderate findings, no high/critical findings. The recommended remediation path is documented above, but the security fixes or a human-approved temporary risk acceptance have not yet been completed.

Before closing Phase 1E:

- [x] Capture the full npm audit report and provenance against the exact candidate dependency graph.
- [x] Record vulnerability counts by severity and identify the two underlying advisories.
- [x] Document the no-downgrade/no-blanket-fix decision and the recommended SDK-compatible remediation path.
- [x] Review and merge PR #83; confirm least-privilege workflow permissions on `main`.
- [x] Verify Mobile CI `verify` and `interoperability` on candidate run [#41368487343](https://github.com/muchlisbstg/export-client-mobile-sync/actions/runs/41368487343).
- [ ] Complete Android Preview debug APK build and artifact upload on run [#41368487390](https://github.com/muchlisbstg/export-client-mobile-sync/actions/runs/41368487390).
- [ ] Approve and implement SDK-compatible remediation, or record explicit temporary risk acceptance.
- [ ] Re-run audit and all quality gates on the post-remediation manifest/lockfile SHA pair.
- [ ] Record CI run URLs, job results, artifact identity, and candidate commit SHA.
- [ ] Keep debug APK testing separate from production AAB signing, release approval, and store submission.
- [ ] Obtain required security, legal, operational, and Syariah approvals before any production release or real transaction enablement.

## 8. References

- [PR #82 — synchronize Expo dependency lockfile](https://github.com/muchlisbstg/export-client-mobile-sync/pull/82)
- [PR #82 merge commit](https://github.com/muchlisbstg/export-client-mobile-sync/commit/9db00cd3e02e606b1fe4f3edfce739504f963cfb)
- [PR #83 — make Android preview workflow read-only](https://github.com/muchlisbstg/export-client-mobile-sync/pull/83)
- [PR #84 — Phase 1E documentation](https://github.com/muchlisbstg/export-client-mobile-sync/pull/84)
- [Android Preview workflow on main](https://github.com/muchlisbstg/export-client-mobile-sync/blob/main/.github/workflows/android-preview-apk.yml)
- [Mobile build and release readiness](./mobile-build-and-release.md)
