# P0 Remediation Tracker

**Document date:** 2026-11-11  
**Repository:** `muchlisbstg/export-client-mobile-sync`  
**Controlling baseline:** [P0 Release Readiness Deep Audit](../P0-RELEASE-READINESS-DEEP-AUDIT-2026-11-11.md)  
**Baseline branch:** `audit/p0-release-readiness-deep-2026-11-11`  
**Baseline commit:** `03221982c06de2ebce23000c703baff3b1e8200b`  
**Tracker branch:** `planning/p0-remediation-tracker-2026-11-11`  
**Tracker mode:** Planning and evidence governance only — no implementation authorized.  
**Overall release status:** **BLOCKED — NOT RELEASE READY**

## 1. Purpose and operating rules

This tracker translates the ordered remediation plan in the controlling P0 baseline into accountable work packages, dependencies, measurable acceptance criteria, and required evidence.

It is a planning artifact. Creating or updating this tracker does not authorize code changes, database changes, migrations, DDL, seed/backfill operations, staging or production mutations, schema freeze, pull-request merge, deployment, or real-money transaction enablement.

### Mandatory controls

1. Preserve the baseline audit report as the historical evidence snapshot. New evidence must be linked through dated addenda or a successor audit revision; do not silently rewrite historical findings.
2. Record the exact repository, branch, commit SHA, workflow run, artifact identifier, SHA-256 digest, test scope, and limitations for every evidence submission.
3. A PASS applies only to the tested scope and SHA. It does not close a broader control unless the acceptance criteria below are met.
4. No work item may be marked DONE without linked evidence and the required reviewer decision.
5. Security and Database reviews must be independent. Reviewer identities are **TBD**; do not infer or self-assign approval.
6. All implementation, when separately authorized, must use isolated working branches and reviewable PRs. No direct `main` writes or automatic merges.
7. No schema freeze, migration, DDL, deployment, or release approval is implied by this tracker.

## 2. Status definitions

| Status | Meaning |
|---|---|
| NOT STARTED | Work package is defined but execution/evidence has not begun. |
| IN PROGRESS | Authorized work is actively being performed on its designated branch or review record. |
| BLOCKED | A prerequisite, decision, integration, or approval prevents progress. |
| READY FOR REVIEW | Acceptance evidence is assembled and awaiting the designated reviewer. |
| DONE | Acceptance criteria are met, evidence is linked, and required independent approval is recorded. |
| NOT APPLICABLE | Only permitted with a written rationale and reviewer acceptance. |

**Initial status rule:** all work items below begin as NOT STARTED or BLOCKED based on known dependencies. No item is pre-approved or marked DONE.

## 3. Prioritized remediation register

| Order / ID | Work package | Priority | Initial status | Dependency |
|---|---|---|---|---|
| 01 — P0-RT-01 | Appoint independent Security and Database reviewers | P0 / Gate | BLOCKED | Management appointment and independence confirmation |
| 02 — P0-RT-02 | Resolve transaction-party model and tenant/transaction/site composite-FK decisions | P0 / Data model | BLOCKED | RT-01; domain decision owners |
| 03 — P0-RT-03 | Inventory actual runtime database, migrations, schema objects, roles, ownership, and policies | P0 / Discovery | NOT STARTED | Read-only access and agreed inventory scope |
| 04 — P0-RT-04 | Establish trusted identity provenance and production RLS boundary | P0 / Security | BLOCKED | RT-01, RT-03, RT-02 where schema-dependent |
| 05 — P0-RT-05 | Integrate verified identity and least-privilege membership in authoritative API | P0 / Backend security | BLOCKED | RT-04; separate implementation authorization |
| 06 — P0-RT-06 | Validate GH-09 / POOL-01 against actual server and multi-connection pool | P0 / Runtime security | BLOCKED | RT-05; disposable test environment and approved test plan |
| 07 — P0-RT-07 | Complete SEC-02 production route/resource negative-access matrix | P0 / Authorization | BLOCKED | RT-01, RT-05; route/resource inventory |
| 08 — P0-RT-08 | Execute GH-06 against canonical DDL and reconciled migrations on PostgreSQL and SQLite | P0 / Database parity | BLOCKED | RT-02, RT-03; canonical schema approved for test |
| 09 — P0-RT-09 | Triage and disposition dependency advisories across Web, Mobile, and Desktop | P0 / Supply chain | NOT STARTED | Current lockfiles and complete machine-readable audit reports |
| 10 — P0-RT-10 | Produce Android APK and iOS runtime evidence with exact SHA provenance | P0 / Platform QA | NOT STARTED | Supported build runners, signing/test setup, candidate SHA |
| 11 — P0-RT-11 | Re-run all release gates on one pinned candidate SHA and complete GH-08 evidence reconciliation | P0 / Evidence | BLOCKED | RT-04 through RT-10; reviewer availability |
| 12 — P0-RT-12 | Verify branch protection and required status checks before merge consideration | P0 / Governance | NOT STARTED | RT-11; repository administration visibility |

## 4. Work package acceptance criteria

### P0-RT-01 — Independent reviewer appointment

**Objective:** establish independent technical oversight before approval-dependent remediation.

Acceptance criteria:
- A Security reviewer and a Database reviewer are explicitly appointed.
- Independence, scope, authority, and any conflicts are documented.
- Each reviewer confirms the baseline commit and the exact artifacts/branches they will review.
- Review decisions are recorded against exact SHAs, with timestamp, findings, and disposition.

Required evidence: appointment record, reviewer scope, independence statement, and review decision template.  
Exit authority: governance owner.  
Initial status: **BLOCKED — reviewer identities not yet recorded.**

### P0-RT-02 — Transaction-party model and composite-FK decisions

**Objective:** close unresolved domain and relational integrity decisions, including transaction-party representation and tenant-scoped transaction/site relationships.

Acceptance criteria:
- ADR and ERD define the transaction-party model and Buyer/Seller tenant boundaries.
- Required tenant–transaction–site composite constraints are explicitly enumerated.
- Parent/child key cardinality, nullability, uniqueness, delete/update behavior, and integrity invariants are documented.
- Failure/independent-item behavior and tenant isolation implications are addressed.
- Independent Database reviewer approves the exact ADR/ERD revision.

Required evidence: ADR, ERD, constraint matrix, decision log, reviewer approval.  
Initial status: **BLOCKED — independent Database reviewer and decisions outstanding.**

### P0-RT-03 — Read-only runtime database and schema inventory

**Objective:** establish what is actually deployed/configured before designing or applying any database change.

Acceptance criteria:
- Inventory identifies runtime database engine/version and the application connection path for each platform.
- Migration ledger and migration file history are reconciled.
- Tables, views, functions, triggers, indexes, constraints, partitions, roles, grants, ownership, RLS policies, and bypass-capable principals are catalogued.
- Observed state is distinguished from repository-intended state.
- No DDL, migration, seed, backfill, or data mutation is performed.

Required evidence: timestamped read-only inventory, schema/object fingerprints, migration reconciliation, and exceptions list.  
Initial status: **NOT STARTED.**

### P0-RT-04 — Trusted identity provenance and production RLS

**Objective:** prove that tenant/user context is derived from verified identity and cannot be forged by an ordinary SQL-capable application session.

Acceptance criteria:
- Threat model documents authentication, identity verification, tenant membership resolution, context propagation, and trust boundaries.
- Caller-settable custom GUCs are not treated as authoritative identity without a separately proven trusted boundary.
- Actual production-intended roles, grants, ownership, policies, functions, views, and BYPASSRLS paths are reviewed.
- Negative tests prove forged tenant/user context, cross-tenant reads/writes, and privilege escalation are rejected.
- Context is isolated across transaction commit, rollback, timeout, cancellation, and connection reuse.
- Independent Security reviewer approves evidence for the exact candidate SHA.

Required evidence: threat model, role/grant/policy inventory, SQL/API negative tests, sanitized logs/artifacts, reviewer sign-off.  
Initial status: **BLOCKED — runtime inventory and independent Security review outstanding.**

### P0-RT-05 — Authoritative API identity and membership integration

**Objective:** ensure authorization is enforced server-side using verified caller identity and least-privilege tenant membership.

Acceptance criteria:
- Production server validates the configured identity token's signature, issuer, audience, expiry, and key-rotation behavior.
- Tenant membership and role are resolved from authoritative server-side records; client-supplied tenant/role claims cannot grant access.
- Route handlers use one authoritative authorization decision path.
- Denied requests do not mutate business data, ledger, evidence, or outbox state.
- Cross-tenant and revoked-membership negative tests pass.
- Security reviewer approves the implementation and test evidence before this work package closes.

Required evidence: implementation PR, API authorization matrix, negative tests, logs/artifacts, exact SHA, reviewer approval.  
Initial status: **BLOCKED — RT-04 must define the trusted boundary; implementation requires separate authorization.**

### P0-RT-06 — GH-09 / POOL-01 production-server and pool validation

**Objective:** replace disposable-adapter-only confidence with evidence from the actual authoritative server and its connection-pool lifecycle.

Acceptance criteria:
- Tests execute against the repository's actual production server composition, not only a disposable Express adapter.
- Pool tests use multiple connections and cover concurrent tenants/users, connection reuse, transaction boundaries, rollback, timeout, cancellation, saturation, and cleanup.
- No tenant/user context leaks between requests, including after failure paths.
- RLS-016 is closed with reproducible evidence.
- Security reviewer approves the exact SHA and evidence.

Required evidence: test plan, server/pool configuration, CI logs, artifacts, concurrency results, RLS-016 disposition, reviewer sign-off.  
Initial status: **BLOCKED — RT-05 and production PostgreSQL integration required.**

### P0-RT-07 — SEC-02 complete production route/resource matrix

**Objective:** prove consistent server-side authorization across all protected operations.

Acceptance criteria:
- Matrix covers route × method × role × tenant × transaction × site × resource state.
- Includes unauthenticated, forged identity, forged tenant, privilege escalation, inactive/revoked membership, wrong site, cross-tenant access, and replay/offline cases where applicable.
- Every denied write is followed by an immutability assertion over affected records and related ledger/evidence/outbox state.
- Positive tests prove permitted access without broadening privileges.
- Results are tied to exact server SHA and independently reviewed by Security.

Required evidence: route/resource inventory, matrix, automated tests, before/after immutability assertions, logs/artifacts, reviewer sign-off.  
Initial status: **BLOCKED — authoritative API integration and route inventory required.**

### P0-RT-08 — GH-06 canonical PostgreSQL / SQLite parity

**Objective:** move beyond the existing synthetic subset and prove required parity against the reconciled canonical schema and migration history.

Acceptance criteria:
- Complete canonical DDL and migration history are reconciled to the RT-03 inventory.
- Equivalent PostgreSQL and SQLite test suites cover relational parity, constraints/FKs, transaction behavior, temporal precision/boundaries, concurrency, negative access, offline replay, and authorization decisions.
- Tenant–transaction–site composite constraints and transaction-party relationships are included.
- Differences are explicitly classified, justified, and approved; no silent behavior divergence remains.
- DEC-008 is resolved with Database reviewer approval and Security concurrence where authorization is affected.

Required evidence: canonical schema version/fingerprint, migration manifest, parity test logs/artifacts, exception register, DEC-008 decision, reviewer approvals.  
Initial status: **BLOCKED — RT-02 and RT-03 prerequisites.**

### P0-RT-09 — Dependency advisory triage

**Objective:** produce an actionable, deduplicated security disposition for each dependency finding across Web, Mobile, and Desktop.

Acceptance criteria:
- Machine-readable audit reports are captured for each dependency root at the same recorded lockfile SHA.
- Findings are deduplicated by package/advisory and classified by severity, exploitability, reachability, fix availability, and platform impact.
- Each finding is remediated or has a documented, time-bounded risk acceptance by an authorized owner.
- Dependency changes are isolated in a branch/PR and pass applicable build, test, and compatibility checks.
- No vulnerability is declared resolved solely because a package version changed; the new audit evidence must confirm the result.

Required evidence: npm audit JSON (or equivalent), lockfile hashes, advisory disposition register, PR and CI evidence, reviewer decision.  
Initial status: **NOT STARTED — full advisory-level reports not yet attached to this tracker.**

### P0-RT-10 — Android APK and iOS runtime evidence

**Objective:** prove installable application artifacts and runtime behavior rather than treating JavaScript bundle export as device proof.

Acceptance criteria:
- Android APK is generated from a pinned candidate SHA and installed/launched on a documented emulator or device.
- iOS app is built from the same candidate SHA and launched on a documented simulator or device.
- Evidence records platform/OS, build configuration, artifact identifier, artifact digest, install/launch result, and relevant runtime smoke tests.
- Authentication, tenant switching/isolation, critical operational workflows, and error handling are covered at an agreed minimum smoke-test scope.
- Build and runtime failures are retained and triaged; no PASS is claimed without observed execution.

Required evidence: APK and iOS build artifacts, SHA-256 digests, build logs, runtime screenshots/logs, test checklist, exact source SHA.  
Initial status: **NOT STARTED — platform runtime evidence absent in baseline.**

### P0-RT-11 — Single-SHA gate rerun and GH-08 evidence reconciliation

**Objective:** assemble one coherent release-candidate evidence package and secure independent approvals.

Acceptance criteria:
- One candidate commit SHA is pinned before the final gate run.
- Applicable GH-05, GH-06, GH-08, GH-09, SEC-02, POOL-01, dependency, and platform runtime checks are run against that candidate or have an explicit, reviewed scope exception.
- Every evidence item includes workflow run, job result, artifact ID, SHA-256, test scope, environment, and limitations.
- Security and Database reviewers record approval/rejection against the same candidate SHA and identify any unresolved findings.
- All blocking findings are closed or formally dispositioned by authorized governance; no implied approval is accepted.

Required evidence: release evidence index, immutable artifacts, digest manifest, reviewer reports, decision log.  
Initial status: **BLOCKED — prerequisite remediation and reviewer approvals outstanding.**

### P0-RT-12 — Branch protection and merge-readiness governance

**Objective:** verify repository controls before a future merge decision.

Acceptance criteria:
- Branch protection/ruleset is inspected with sufficient administrative visibility.
- Required status checks, required reviews, stale approval dismissal, conversation resolution, and restrictions on direct pushes are documented and tested where appropriate.
- Required reviewers and checks reflect the approved P0 governance model.
- Any policy change is separately authorized and reviewed.
- Merge readiness is reported as a recommendation only; this tracker does not merge any PR.

Required evidence: ruleset/branch-protection snapshot, required-check list, review policy, administrative verification, governance approval.  
Initial status: **NOT STARTED.**

## 5. Cross-workstream dependencies and sequencing

The numbered order is the controlling priority order. Work may be prepared in parallel only when it does not bypass a prerequisite or change-control gate.

- RT-01 is a governance prerequisite for approval-dependent work.
- RT-02 and RT-03 establish domain/schema intent and observed runtime facts before RLS and parity closure.
- RT-04 establishes the trusted identity/RLS design before RT-05 implementation.
- RT-05 is a prerequisite for production-server pool testing and complete route-level SEC-02 validation.
- RT-08 depends on canonical schema reconciliation and domain decisions.
- RT-09 and RT-10 may be planned independently, but any changes/builds still require isolated branches and approved scope.
- RT-11 is the consolidation gate after evidence-producing work packages.
- RT-12 informs merge consideration only after evidence and approvals are ready.

## 6. Global exit criteria for P0 Release Readiness

P0 may be recommended for release-readiness approval only when all of the following are true:

1. No unresolved P0 security or database blocker remains.
2. Trusted identity provenance and production RLS are demonstrated against the actual server/database composition.
3. SEC-02 and POOL-01 negative-access and context-isolation evidence passes on the pinned candidate SHA.
4. Canonical PostgreSQL/SQLite schema, constraint, transaction, temporal, concurrency, and authorization parity is independently reviewed.
5. Dependency advisories have complete evidence-based dispositions.
6. Android APK and iOS runtime evidence is available and traceable to the candidate SHA.
7. GH-08 evidence package is complete, immutable, and reconciled.
8. Independent Security and Database approvals are recorded for the exact candidate SHA.
9. Branch protection and required checks are verified.
10. Any legal/Syariah approval required for financial or real-money workflows is obtained before such workflows are enabled.

Meeting these criteria makes the candidate eligible for a formal governance decision; it does not itself authorize merge, deployment, schema freeze, or live transactions.

## 7. Current baseline snapshot

| Baseline finding | Starting disposition |
|---|---|
| GH-05 disposable fixture | PASS within fixture scope; identity provenance NOT VERIFIED |
| GH-05 production RLS | BLOCKED |
| GH-06 synthetic parity corpus | PASS within synthetic scope; canonical parity NOT VERIFIED |
| DEC-008 | OPEN |
| GH-08 evidence reconciliation | BLOCKED |
| GH-09 disposable context harness | PASS within harness scope; RLS-016 BLOCKED |
| SEC-02 production route matrix | NOT VERIFIED |
| POOL-01 multi-connection lifecycle | NOT VERIFIED |
| Dependency security | FAIL pending advisory-level triage |
| Android APK runtime | NOT VERIFIED |
| iOS runtime | NOT VERIFIED |
| Independent Security approval | BLOCKED |
| Independent Database approval | BLOCKED |
| Schema Freeze | NOT APPROVED |
| P0 Release Readiness | **BLOCKED** |

## 8. Change log

| Date | Change | Evidence |
|---|---|---|
| 2026-11-11 | Initial tracker created from the official P0 baseline; no implementation performed. | Tracker planning branch; baseline commit `03221982c06de2ebce23000c703baff3b1e8200b` |

---

**Governance statement:** This tracker is a planning and accountability register only. It does not contain or authorize implementation changes. All work remains subject to explicit scope approval, isolated branches, reproducible evidence, independent review, and the repository's change-control rules.
