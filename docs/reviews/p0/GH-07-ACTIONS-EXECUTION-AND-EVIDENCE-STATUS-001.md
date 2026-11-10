# GH-07-ACTIONS-EXECUTION-AND-EVIDENCE-STATUS-001

**Status:** WORKFLOW COMMITTED; RUN AND ARTIFACT READBACK NOT VERIFIED
**Date:** 2026-11-10
**Repository:** muchlisbstg/export-client-mobile-sync
**Branch:** `review/p0-domain-schema-readonly-2026-11-10`
**Workflow:** `.github/workflows/p0-disposable-db-gates.yml`
**Workflow commit:** `488d1414cbb333c2beac460863d4d1e71397ca25`

## 1. Workflow configuration

The workflow is configured for push to the review branch when the disposable DB gate files or workflow change, and supports manual dispatch. It provisions an ephemeral PostgreSQL 16.10 service, runs the parity subset and RLS suite, writes sanitized JSON/manifest artifacts, uploads the artifacts even when tests fail, and then fails closed unless both suites exit zero.

The workflow uses synthetic fixtures, an ephemeral database service, a test-only API role and no production/staging secrets or connection strings.

## 2. Evidence that is available

- Workflow file fetched back from the exact review branch and verified.
- RLS SQL, RLS runner and parity runner fetched back from the same branch and verified.
- GitHub commit status for the workflow commit shows a Vercel context with success. This is not an Actions test result.
- GitHub connector's `fetch_commit_workflow_runs` returned an empty list; that wrapper only returns pull-request-triggered runs and does not establish whether the push-triggered workflow ran.
- The available GitHub read interface did not expose a usable workflow-run listing/dispatch action in this session. A direct workflow-run page fetch was also unavailable.

## 3. What is not claimed

No GitHub Actions run ID, job result, test pass, log, or uploaded artifact has been independently read back in this review. The workflow configuration and successful documentation commit do not prove the workflow executed.

The RLS runner intentionally records RLS-016 as BLOCKED until a separate API-level forged-tenant-context negative test is implemented. Therefore a fully green DEC-006 gate is not expected yet. The parity runner is explicitly a 10-case subset, not all 16 DEC-008 cases.

## 4. Required evidence handoff

After the workflow run appears in GitHub Actions, capture:
- run URL and run ID;
- exact head SHA;
- job conclusion and step outcomes;
- uploaded artifact ID/name and download URL;
- parity JSON, RLS JSON, exit status and evidence manifest;
- PostgreSQL and SQLite engine versions and schema fingerprint;
- each failed/blocked case with remediation owner and follow-up commit.

If no run appears, manually dispatch the workflow from the review branch and record the run URL. Do not rerun against any non-disposable environment.

## 5. Disposition

- Workflow definition: committed and read-back verified.
- Workflow execution: NOT VERIFIED.
- Artifact collection: configured, not read back.
- DEC-006: OPEN.
- DEC-008: OPEN.
- No schema freeze decision is supported by this evidence record.
