# GITHUB-FIRST-DEC-006-008-EXECUTION-PLAN-001

**Status:** EXECUTION PLAN — NO TEST PASS CLAIMED
**Date:** 2026-11-10
**Repository:** muchlisbstg/export-client-mobile-sync
**Branch:** review/p0-domain-schema-readonly-2026-11-10
**Baseline commit:** 11657fcf4057f83172df5a831007cbcf571f2119
**Scope:** Repository inspection, disposable CI execution, evidence capture and cross-platform source reconciliation.
**Safety boundary:** No production/staging credentials or data; no live DB mutation; no migration, merge, deployment, main-branch write or schema freeze.

## 1. Operating decision

Proceed GitHub-first. GitHub is the source-controlled coordination and evidence ledger. Repository source, test code, workflow definitions, commit identities, workflow runs, logs and artifacts will be reviewed there first.

GitHub repository evidence alone does **not** prove which SQLite file an already-running API process has open. DEC-007 must remain OPEN until a host-side runtime attestation, tied to the deployed commit and actual process, is attached to this review branch. Do not substitute CI test SQLite, source defaults or a developer shell for actual API process provenance.

## 2. Execution sequence

| Sequence | Workstream | Required output | Closure rule |
|---|---|---|---|
| GH-01 | Baseline inventory | Source paths, schema/migration files, DB constructors, auth middleware, Web/Mobile/Desktop API clients, current workflow inventory; each pinned to branch + SHA | No undocumented source assumptions |
| GH-02 | DEC-006 executable RLS | Disposable PostgreSQL setup, least-privilege non-owner/non-BYPASSRLS API role, reviewed policy SQL, RLS-001–018 tests | All required positive/negative tests pass; logs and tested SHA retained |
| GH-03 | DEC-008 parity harness | Executable shared fixtures/adapters, pinned PostgreSQL and SQLite versions, PAR-001–016 tests, normalized report | Both disposable engines run same fixtures; no skipped mandatory case; divergence reconciled |
| GH-04 | Cross-platform reconciliation | Web/Mobile/Desktop contract matrix against canonical identity, tenant, participant, membership, site, action and lifecycle rules | Every discrepancy closed or explicitly retained as blocker with evidence |
| GH-05 | DEC-007 runtime attestation | Host-generated, sanitized provenance report for actual API PID/container, opened SQLite path identity, embedded version, connection paths, PRAGMAs and schema fingerprint | Independently reviewable and tied to deployed commit; no DB contents/secrets included |
| GH-06 | Evidence review | Consolidated gate report with run IDs, artifact links, commit SHAs, findings and reviewer decisions | All critical gates closed and explicit human approval recorded |

## 3. GitHub Actions safety design

The disposable test workflow must:
- run only on this review branch or an explicitly approved pull-request context;
- provision ephemeral PostgreSQL with a pinned image and create a temporary SQLite database;
- use synthetic fixtures only;
- refuse production/staging connection strings and never read repository secrets for database targets;
- use a non-owner PostgreSQL application role for RLS tests;
- destroy disposable resources even on failure;
- upload machine-readable results, schema fingerprints and sanitized logs as workflow artifacts;
- fail closed on skipped tests, missing versions, missing artifacts or unreviewed divergence.

No workflow should deploy, migrate or mutate shared environments. Do not trigger any workflow until its YAML and scripts have been reviewed for these boundaries.

## 4. Evidence contract

Every test result must identify:
- repository and branch;
- exact commit SHA;
- workflow run URL/ID and job;
- PostgreSQL image/version and SQLite library version;
- fixture-set version/hash;
- test case IDs and pass/fail/skip counts;
- normalized outcomes and schema fingerprints;
- artifact URLs and reviewer disposition.

A green workflow is evidence only for the exact code and disposable environment tested. It is not proof of production deployment state or actual API host provenance.

## 5. DEC-007 host attestation format

The host operator must produce a sanitized report from the actual API process/runtime. It should include process/container identity, deployed commit/build ID, actual opened database path identity (path may be redacted consistently, but must be distinguishable), SQLite engine version obtained through the API's actual connection, all connection/reopen paths, `PRAGMA database_list`, `PRAGMA foreign_keys`, `PRAGMA integrity_check`, `PRAGMA foreign_key_check`, and a schema-only fingerprint.

Do not upload database files, WAL/SHM files, row data, tokens, environment dumps, credentials or customer information. If GitHub-hosted execution is not the API host, its SQLite file is not acceptable as DEC-007 runtime provenance.

## 6. Cross-platform review checklist

- Canonical PostgreSQL authority and SQLite offline-only boundary are consistent.
- No legacy single-enterprise authorization path supersedes approved multi-tenant DEC-001–005.
- User, tenant, legal party, membership and transaction participant identities remain distinct.
- Composite keys/FKs and participant/site-link/action scopes are consistent.
- Lifecycle transitions, revocation, expiry, replay and rollback fail closed.
- Web, Mobile and Desktop send the same canonical API identity/context contract.
- Backend authorization remains authoritative; client-side role checks are not treated as security controls.
- Supplier cannot acquire contract, payment, ledger or goods-release authority through any platform.

## 7. Current disposition

- DEC-006: logical policy matrix accepted; executable RLS test evidence not yet recorded.
- DEC-007: actual API runtime provenance not yet available; GitHub-only evidence cannot close it unless the API process itself is verifiably running in that GitHub-controlled runtime.
- DEC-008: harness contract specified; executable dual-engine parity run not yet recorded.
- Cross-platform reconciliation: pending source-pinned inspection and test evidence.
- Schema freeze: **NOT READY**.

This plan authorizes repository review and preparation of disposable-only test assets on the review branch. It does not authorize production/staging access, migrations, DDL deployment, merge, release or schema freeze.
