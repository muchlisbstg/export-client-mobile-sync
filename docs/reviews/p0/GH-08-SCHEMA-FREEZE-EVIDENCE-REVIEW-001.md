# GH-08-SCHEMA-FREEZE-EVIDENCE-REVIEW-001

**Status:** FINAL REVIEW — SCHEMA FREEZE NOT READY
**Date:** 2026-11-10
**Review branch:** `review/p0-domain-schema-readonly-2026-11-10`
**Workflow file commit:** `488d1414cbb333c2beac460863d4d1e71397ca25`
**Latest harness source commit:** `5ac0986e97ed1bf21d7013c2746d58a85fee1afe`
**Decision:** NO FREEZE; return to technical remediation and evidence collection.

## 1. Executive decision

GH-04 through GH-07 created a proposed canonical cross-platform contract, a disposable PostgreSQL RLS fixture, a PostgreSQL/SQLite parity subset, and a GitHub Actions workflow configured to execute those tests. The workflow and source files were read back from GitHub. However, Actions run results and uploaded artifacts were not accessible for independent verification in this session.

The current work is an executable test scaffold and design reconciliation package. It is not proof that the three applications have been migrated to the canonical API, that production schema is physically aligned, or that DEC-006/008 passed.

## 2. Gate review

| Gate | Evidence available | Status |
|---|---|---|
| GH-04 canonical API contract | Proposed shared contract document; no implementation route-by-route proof | OPEN — DESIGN PROPOSAL |
| GH-05 disposable PostgreSQL RLS | Test-only SQL and runner; RLS-016 explicitly blocked pending API integration; Actions run not verified | OPEN — PARTIAL HARNESS |
| GH-06 PostgreSQL/SQLite parity | Executable 10-case subset; not all 16 cases; concurrency/lifecycle/offline replay incomplete; run not verified | OPEN — PARTIAL HARNESS |
| GH-07 Actions and artifacts | Workflow committed/read-back verified; run ID, logs and artifact not independently retrieved | OPEN — EXECUTION EVIDENCE MISSING |
| GH-08 evidence review | This review records blockers and disposition | COMPLETE AS REVIEW ONLY |

## 3. Cross-platform reconciliation findings still open

- Web, Mobile and Desktop currently contain independent SQLite-backed persistence/inquiry peer-sync behavior.
- Mobile source still contains the legacy single-enterprise authorization implementation.
- The proposed canonical API contract is not yet implemented and verified across the three repositories.
- Desktop's local API/authentication/IPC trust boundary has not been reconciled by executable negative tests.
- Existing inquiry interoperability tests remain separate from canonical transaction authorization and schema parity.
- No deployed PostgreSQL authoritative transaction service was evidenced by the source review.
- DEC-007 actual API process-to-SQLite-file provenance remains unavailable and must be obtained from the real API host.

## 4. DEC-006 closure blockers

1. Add and pass the API-level forged tenant selector/context test for RLS-016.
2. Review role attributes, grants, table ownership, FORCE RLS and complete physical table/view/partition/function coverage.
3. Replace the fixture's limited policies with the final approved physical schema policy set.
4. Verify actual backend context derivation and pool reset.
5. Execute all RLS-001–018 on disposable PostgreSQL using the real non-bypass application role.
6. Read back the exact Actions run logs and artifact.

## 5. DEC-008 closure blockers

1. Expand the 10-case subset to all PAR-001–016.
2. Add concurrent overlapping verified-binding writes; exactly one conflicting write must succeed.
3. Add full participant/assignment lifecycle, revocation, expiry and offline replay cases.
4. Add approval evidence and contract-party immutability cases.
5. Pin and report exact PostgreSQL and SQLite library versions, schema fingerprints and fixture hash.
6. Run both engines on the identical synthetic fixture corpus and reconcile every divergence.
7. Read back Actions logs and machine-readable comparison artifact.

## 6. DEC-007 remains an independent blocker

GitHub-hosted disposable CI cannot prove which SQLite database the actual API process has open. Obtain sanitized evidence from the actual host/container: process/build identity, open database path identity, embedded SQLite version through the process's actual connection, all connection constructors, PRAGMAs, schema-only inventory, integrity/foreign-key checks and fingerprint. Do not upload database files, operational rows, WAL/SHM files or secrets.

## 7. Explicit freeze decision

**SCHEMA FREEZE: NOT APPROVED / NOT READY.**

No final schema freeze is authorized by this review. DEC-001–DEC-005 remain the approved logical domain baseline. DEC-006, DEC-007 and DEC-008 remain open. No migration, DDL deployment, merge, main-branch write, release or deployment was performed.

The next acceptance checkpoint is a human review of the Actions run URL and artifacts, followed by completion of the blocked API and parity cases. Only after all critical evidence is reconciled should a separate explicit schema-freeze decision be requested.
