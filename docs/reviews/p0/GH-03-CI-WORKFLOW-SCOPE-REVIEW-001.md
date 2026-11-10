# GH-03-CI-WORKFLOW-SCOPE-REVIEW-001

**Status:** READ-ONLY WORKFLOW DEFINITION REVIEW — EXECUTION RESULTS NOT VERIFIED
**Date:** 2026-11-10
**Coordination branch:** `review/p0-domain-schema-readonly-2026-11-10`
**No workflow was dispatched, re-run, cancelled or modified.**

## 1. Workflow files reviewed

| Repository | Workflow | Blob SHA | Relevant behavior |
|---|---|---|---|
| Web `muchlisbstg/export-client-web-sync` | `.github/workflows/ci.yml` | `0592e168997b5dc40235e46f2c7c0fbf52bbc05a` | Push, PR, manual and daily schedule; npm test/build; three-backend interoperability job |
| Mobile `muchlisbstg/export-client-mobile-sync` | `.github/workflows/ci.yml` | `0b1839ccfa872abcbbe1c1273f9eedca34ca3574` | Push/PR; three-backend interoperability; npm test, typecheck, Expo dependency check and Android JS bundle |
| Desktop `muchlisbstg/export-client-desktop-sync` | `.github/workflows/ci.yml` | `d1975c9e9dc555a801f394c665f785907805734f` | Push/PR to main; three-backend interoperability; npm test, typecheck and build |
| Mobile | `.github/workflows/p0-schema-reconciliation.yml` | `1026d9c69552d4e121dd4e2f722c9f1eadbf65e1` | SQLite schema inspector and tenant/supply-chain/transaction authorization tests |
| Mobile | `.github/workflows/p0-complete-auth-matrix.yml` | `6efc6f547f8eb36a69d99cd21f74112866d84dfd` | Existing endpoint authentication matrix and authorization regression tests |
| Mobile | `.github/workflows/p0-security-authorization.yml` | `d5bfc36579a15ac13d9a3708ef55b343e59b71e3` | Existing security authorization negative tests and regression tests |

## 2. What current CI does establish by design

- Web CI runs API synchronization tests and a Web build.
- The interoperability jobs check out the other two repositories at their `main` refs and run the Web repository's `test:interop` script.
- The documented interop runbook uses temporary SQLite databases and synthetic inquiry records.
- Mobile CI separately runs the current Mobile test suite, TypeScript check, Expo dependency compatibility check and Android JavaScript bundle export.
- Desktop CI separately runs its tests, TypeScript check and build.
- Mobile P0 schema/auth workflows run Node tests against the existing source and test files.

## 3. What current CI does not establish

The reviewed workflow definitions do not provision PostgreSQL, execute PostgreSQL RLS policies using a non-bypass application role, or run the DEC-006 RLS-001–018 corpus. They do not execute the DEC-008 shared PostgreSQL/SQLite fixture parity suite. The existing three-backend interoperability job is a local-SQLite inquiry replication test, not canonical transaction schema parity.

The reviewed P0 schema workflow runs `test/schema-reconciliation-contract.test.mjs`, `tenant-migration.test.mjs`, `enterprise-bootstrap.test.mjs`, `supply-chain.test.mjs` and `transaction-authorization.test.mjs`; the workflow definition alone does not establish their most recent execution result or prove that they test PostgreSQL RLS.

## 4. Execution evidence status

Workflow YAML was fetched and reviewed. Workflow run histories and job logs were not verified in this step. A separate attempt to query workflow-run collections through the available GitHub read interface was rejected by its endpoint allowlist; this is a tooling limitation, not evidence that no workflow runs exist.

No Actions run was started or re-run. The GitHub commit status named `Vercel` observed on the documentation commit is not an Actions test result and must not be represented as DEC-006/008 evidence.

## 5. Required CI additions before gate closure

1. Add a disposable PostgreSQL service with a pinned image/version and a separate non-owner, non-superuser, non-BYPASSRLS application role for DEC-006.
2. Run RLS-001–018 against the exact reviewed policy/schema commit, including pooled-connection tenant-context reset and indirect view/function paths.
3. Add a dual-engine disposable parity job for DEC-008 using one immutable fixture corpus and pinned PostgreSQL/SQLite versions.
4. Emit schema fingerprints, test-case outcomes, engine versions, commit SHA, run ID, and sanitized artifacts.
5. Reject production/staging connection strings; use no production/staging secrets; guarantee disposable resource cleanup.
6. Pin all cross-repository checkout refs to exact SHAs for reproducible interop evidence rather than relying only on moving `main` refs.
7. Keep current inquiry peer-sync tests separate from canonical transaction-domain parity tests.

## 6. Disposition

- Workflow definitions: reviewed.
- Existing SQLite inquiry interop test design: documented.
- Current Actions execution outcomes: **NOT VERIFIED**.
- DEC-006 RLS test: **NOT PRESENT IN THE REVIEWED WORKFLOW DEFINITIONS**.
- DEC-008 dual-engine parity test: **NOT PRESENT IN THE REVIEWED WORKFLOW DEFINITIONS**.
- DEC-007 actual API runtime provenance: **NOT ADDRESSED BY CI SOURCE REVIEW**.
- Schema freeze: **NOT READY**.

No test pass is claimed. No workflow or repository implementation was modified.
