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

## 6. npm vulnerability audit — evidence gap

The baseline Android Preview workflow used `npm ci --no-audit`, so it did not produce npm's vulnerability report. A follow-up workflow change is being proposed to run `npm audit --json`, retain its exit code, and upload the raw JSON/stderr as a 30-day artifact. Until that run completes and its artifact is inspected, this report does not state a finding count or severity distribution. The required report must include:

- Exact commit SHA and lockfile blob/commit reference.
- Node.js and npm versions.
- Audit command and timestamp.
- Full finding metadata (package, advisory/GHSA, severity, affected range, fix availability, dependency path).
- Risk disposition, owner, and target remediation/review date.

Accordingly, this report intentionally does **not** state a finding count, severity distribution, or a “zero vulnerabilities” result.

### Reproducible evidence capture

Run from a clean checkout of the target commit, using the project's supported Node.js runtime:

```bash
git rev-parse HEAD
node --version
npm --version
npm ci --ignore-scripts --no-audit
npm audit --json > npm-audit.json
```

Record the exit code of `npm audit` separately because a non-zero exit can indicate findings and should not cause the JSON report to be discarded. Review whether disabling lifecycle scripts is appropriate for the audit environment; do not treat this command as the application's full build validation.

Attach the raw report to a restricted CI artifact or a reviewed audit record. Avoid committing secrets, environment files, private registry credentials, or sensitive internal URLs.

### Required vulnerability register

| Field | Required value |
|---|---|
| Package | Exact affected package |
| Advisory | GHSA/CVE/npm advisory identifier |
| Severity | npm-reported severity, plus contextual risk assessment |
| Dependency path | Direct/transitive path from the lockfile |
| Affected range | Advisory's affected version range |
| Installed version | Exact locked version |
| Fix availability | Fixed version or no fix available |
| Runtime exposure | Production, build-time, development-only, or unclear |
| Decision | Remediate, mitigate, accept temporarily, or investigate |
| Owner / due date | Named accountable owner and review deadline |
| Evidence | Audit report, commit SHA, and validation run |

Do not automatically upgrade Expo/React Native packages solely to silence an advisory. Validate compatibility against the Expo SDK matrix and run the complete regression gate before accepting dependency changes.

## 7. Decision and release gate

**Decision: HOLD on closing Phase 1E.** Lockfile synchronization and PR #83 workflow hardening are verified, but a complete `npm audit --json` report and the final same-candidate quality-gate evidence are still pending.

Before closing Phase 1E:

- [ ] Capture a full npm audit report against the exact candidate commit and lockfile.
- [ ] Classify every finding and record a human-approved disposition.
- [ ] Confirm the Expo SDK compatibility matrix after any proposed dependency change.
- [ ] Require `npm ci` against the committed lockfile.
- [ ] Require tests, typecheck, Expo compatibility, Android export, Prebuild, and debug APK build to pass on the same candidate commit.
- [x] Review and merge PR #83; confirm least-privilege workflow permissions on `main`.
- [ ] Run and inspect the `npm audit --json` artifact from the candidate commit.
- [ ] Record npm vulnerability counts by severity and a disposition for each advisory.
- [ ] Confirm all quality gates pass on the same candidate commit.
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
