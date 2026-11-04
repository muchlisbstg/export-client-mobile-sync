# P0 Security Authorization Review — Technical Evidence Pack

**Status:** Technical pre-review; P0 remains OPEN  
**Repository:** `muchlisbstg/export-client-mobile-sync`  
**Baseline main SHA:** `73e75edad71c5a6f8819e80c5ffdeabf32314c3d`  
**Work branch:** `release-readiness/p0-expo58-schema-blueprint-2026-11-04`  
**Reviewers:** Security and Database reviewers still require explicit appointment/approval  
**Scope:** API authentication, single-enterprise membership, enterprise roles, site scope, transaction assignment boundaries

## Governance

- This evidence pack authorizes no additional merge, deployment, staging mutation, SQL migration, or production action. PRs #114 and #115 were already merged into `main` before this branch was created; this work does not reverse those repository events.
- Tests in this document are synthetic and must not use operational database data.
- Passing automated tests does not replace independent Security and Database review.
- P0 remains open until the complete endpoint matrix, negative tests, runtime evidence, and independent approval are accepted.

## Endpoint authorization matrix

| Method / endpoint | Exposure | Authentication | Enterprise / role gate | Site / resource gate | Negative tests |
|---|---|---|---|---|---|
| GET `/health` | Public liveness | None | None; response limited to `{status:"ok"}` | None | Verify no node/peer/queue details |
| GET `/api/v1/products` | Public catalog | None | None | Active products only | Public contract |
| POST `/api/v1/inquiries` | Public inquiry intake | None | None | Input validation, active product | Invalid body, rate limit |
| GET `/api/v1/inquiries/:trackingCode` | Public tracking | None | Possession of high-entropy tracking code | Tracking code format + record existence | Invalid/unknown code |
| GET `/api/v1/auth/session` | Protected identity | Valid Supabase bearer | Auth identity only | No-store response | Missing, invalid, expired token |
| GET `/api/v1/enterprise/session` | Protected enterprise context | Valid bearer | Active membership in configured enterprise; active recognized roles | Locked single-enterprise context | Missing membership, suspended membership, tenant override |
| GET `/api/v1/admin/session` | Platform admin | Valid bearer | Server-side admin allowlist | No user-metadata elevation | Forged metadata, non-admin token |
| GET `/api/v1/transactions` | Protected transaction list | Valid bearer | Active enterprise + one of admin/buyer/seller/supplier/warehouse/qc/logistics/auditor | Transaction visibility filtered to enterprise; transaction access assignment policy applies in supply-chain route layer | Missing token, no role, cross-enterprise |
| GET `/api/v1/transactions/:id` | Protected transaction read | Valid bearer | Active enterprise + recognized transaction role | Enterprise boundary and explicit transaction assignment/site link | Cross-enterprise ID, missing assignment, wrong site |
| POST `/api/v1/transactions` | Retired legacy write | Valid bearer + active enterprise | No role grant; intentionally retired | Returns 410 | Unauthenticated request, verify 410 for authenticated caller |
| PATCH `/api/v1/transactions/:id/status` | Retired legacy write | Valid bearer + active enterprise | No role grant; intentionally retired | Returns 410 | Unauthenticated request, verify 410 for authenticated caller |
| POST `/api/v1/sync/inquiries` | Peer sync | Shared secret + configured peer identity | Peer allowlist | Payload schema + product consistency | Missing/wrong secret, unknown peer |
| POST `/api/v1/sync/tenants` | Retired legacy sync | None | Retired | Returns 410 | Verify retired contract |
| POST `/api/v1/supply/sites` | Site administration | Valid bearer | Active enterprise + enterprise_admin | Site creation validation | Non-admin role |
| POST/DELETE `/api/v1/supply/sites/:siteId/assignments[/:userId]` | Site assignment administration | Valid bearer | Active enterprise + enterprise_admin | Target must be active enterprise member with active role compatible with site type (new remediation) | Non-member, suspended member, no active role, incompatible role |
| POST `/api/v1/supply/lots` | Lot intake | Valid bearer | Admin/supplier/warehouse | Active compatible site + active user-site assignment unless admin | Foreign, inactive, unassigned, incompatible site |
| POST `/api/v1/supply/lots/:lotId/inspections` | QC inspection | Valid bearer | Admin/qc | Body site must be active, compatible, assigned | Wrong role, cross-site |
| POST `/api/v1/supply/processing` | Warehouse processing | Valid bearer | Admin/warehouse | Body site scope | Wrong role, cross-site |
| POST `/api/v1/supply/movements` | Inventory movement | Valid bearer | Admin/warehouse/logistics | Both source and destination sites must pass scope | One-sided authorization, foreign site |
| POST `/api/v1/supply/evidence` | Evidence capture | Valid bearer | Admin/buyer/seller/supplier/warehouse/qc/logistics/auditor | Entity and site authorization in service | Foreign entity/site, unauthorized role |
| GET `/api/v1/supply/stock` | Stock read | Valid bearer | Admin/buyer/warehouse/qc/logistics/auditor | Requested site scope | Supplier-only role, foreign/unassigned site |
| GET `/api/v1/supply/lots/:lotId/trace` | Lot traceability | Valid bearer | Admin/buyer/seller/warehouse/qc/logistics/auditor | Lot origin site scope | Foreign/unassigned site |
| POST `/api/v1/supply/handovers` | Handover preparation | Valid bearer | Admin/warehouse/logistics | Both source and destination sites | One-sided authorization |
| POST `/api/v1/supply/handovers/:handoverId/dispatch` | Handover dispatch | Valid bearer | Admin/logistics | Source-site assignment | Wrong role/site |
| POST `/api/v1/supply/handovers/:handoverId/receive` | Handover receipt | Valid bearer | Admin/warehouse/logistics/qc | Destination-site assignment | Wrong role/site |
| POST `/api/v1/transactions/:id/access-assignments` | Transaction access administration | Valid bearer | Active enterprise + enterprise_admin | Transaction belongs to enterprise; target role grant active; buyer/seller side membership; operational role requires linked site | Non-admin, foreign transaction, invalid target role/site |
| DELETE `/api/v1/transactions/:id/access-assignments/:userId/:role` | Transaction access revocation | Valid bearer | Active enterprise + enterprise_admin | Scoped to enterprise + transaction + user + role | Non-admin, foreign transaction |
| POST `/api/v1/transactions/:id/site-links` | Transaction-site administration | Valid bearer | Active enterprise + enterprise_admin | Transaction and active site belong to enterprise; purpose allowlist | Non-admin, foreign transaction/site, invalid purpose |

## Test coverage and evidence

Existing automated suites on baseline:

- `test/p0-endpoint-auth-matrix.test.mjs`: missing, invalid, and expired bearer tokens across protected method/path cases; public and retired endpoint contracts.
- `test/p0-role-enterprise-site.test.mjs`: active membership, suspended membership, tenant override, role denial, foreign/inactive/unassigned/incompatible site, and two-sided transfer authorization.
- `test/security-authorization-remediation.test.mjs`: metadata forgery cannot grant admin; explicit server-side admin allowlist.
- `test/authorization.test.mjs`: active role resolution, forged enterprise context, missing identity, revoked membership, unknown role denial.

New branch remediation:

- `server/supply-chain-routes.mjs`: site assignment now verifies the target has active membership in the configured enterprise and at least one active role compatible with the target site type before granting assignment.
- `test/p0-role-enterprise-site.test.mjs`: adds negative tests for non-member, suspended member, no active role, incompatible role, plus a positive compatible assignment.

## Findings

### SEC-P0-ASSIGNMENT-TARGET-01 — Site assignment target was not validated

**Severity:** High-priority authorization/data-integrity finding; exploitability not yet independently assessed.  
**Evidence:** Previous handler checked that the site was active and the caller was enterprise_admin, but only checked that target `userId` was non-empty. It did not validate target enterprise membership or active compatible role.  
**Impact:** Could create stale or unusable site assignments for arbitrary user IDs or users without the corresponding enterprise role. This is an authorization-integrity gap; do not describe it as confirmed privilege escalation.  
**Remediation:** Added active membership and compatible active role checks before insert/upsert.  
**Verification:** New synthetic negative/positive cases added; execution evidence is pending CI/runtime test run.

### SEC-P0-HEALTH-CONTRACT-02 — Public health contract mismatch

**Evidence:** Server returns only `{status:"ok"}` by design; the previous client contract required `nodeId`, `syncEnabled`, and `syncStatus`.  
**Impact:** The client could show a healthy API as unavailable and encouraged operational sync details to be placed on a public endpoint.  
**Remediation in current branch:** Client health type and UI now match the minimal liveness contract; the UI no longer requests or displays peer topology, queue depth, retry counts, or conflict counts. `test/p0-health-cors-contract.test.mjs` and `test/api.test.mjs` cover the contract.  
**Verification:** Awaiting CI on the current branch SHA.

### SEC-P0-CORS-HEADERS-03 — Browser preflight method/header coverage

**Evidence:** API routes include `PATCH` and `DELETE`; enterprise context middleware reads `X-Active-Tenant-Id`. The previous CORS policy allowed only `GET, POST, OPTIONS` and `Content-Type, Authorization`.  
**Impact:** Browser preflight for supported mutation methods or explicit enterprise context could fail before reaching authorization middleware.  
**Remediation in current branch:** CORS now allows only the configured origin, methods `GET, POST, PATCH, DELETE, OPTIONS`, and headers `Content-Type, Authorization, X-Active-Tenant-Id`. No wildcard origin or credentialed-cookie access is introduced.  
**Verification:** Synthetic preflight tests cover allowed methods/headers and untrusted-origin denial; CI pending.

### SEC-P0-ASSIGNMENT-ROLE-04 — Transaction/site assignment lifecycle

**Evidence:** Transaction access assignment handler validates target active role grant and transaction/site link; site assignment handler now validates membership and compatible role.  
**Remediation/test in current branch:** Added a synthetic regression asserting site-assignment revocation and enterprise-role revocation deny the next request. Existing transaction read paths re-check active access and site assignments.  
**Open review:** Independent reviewer must still assess concurrency/race windows, stale assignment cleanup, and audit failure behavior.

## Required reviewer checks

1. Independently inspect the full route matrix and middleware ordering.
2. Run all negative tests against an isolated synthetic SQLite fixture.
3. Add/verify cross-enterprise and cross-site read tests for every resource endpoint, not only lot intake.
4. Verify that role revocation and site assignment revocation take effect immediately.
5. Inspect audit failure behavior and ensure denied writes cannot commit partial mutations.
6. Review health/CORS follow-ups and confirm no sensitive metadata is exposed.
7. Record reviewer identity, competence, conflicts, commit SHA, findings, and explicit disposition.

## Evidence status

| Evidence | Status |
|---|---|
| Baseline SHA and branch ancestry | Verified |
| Endpoint inventory from route registrations | Documented in `docs/security/endpoint-authorization-matrix.md`; duplicate transaction route declarations flagged |
| Existing authorization test inventory | Verified by source inspection |
| New site-assignment remediation | Committed to isolated branch |
| New negative/positive test cases | Committed; current branch CI pending |
| Prior P0 authorization CI | Run `41782702454` passed on PR head `2e3f082`; latest Mobile CI on main `73e75ed` passed run `41782801995` |
| Independent Security review | Pending; reviewer not appointed |
| Database review / migration approval | Pending; no migration created or applied |
| P0 closure | OPEN — current branch CI and independent Security/Database approvals still required |
