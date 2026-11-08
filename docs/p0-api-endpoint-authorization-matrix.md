# P0 API endpoint authorization matrix

**Current integration baseline:** `79bf932b85b5e7bc618a42de8feb6565061ef869` (2026-11-08; current main merge baseline).  
**Historical expanded test matrix:** source/test evidence originally assembled in PR #119; revalidated against the current source file inventory during PR #128 preparation.  
**Audited baseline:** `5da5ecf950f6269048312d2c9353d8e912a9ff41`  
**Remediation/test head for this evidence update:** `b572a5e299e6fe8ad4caf88505e7a21025c0a5bc`  
**Inventory method:** static extraction from `server/index.mjs` and `server/supply-chain-routes.mjs`, cross-checked against middleware registration, auth helpers, and test source.  
**Route count:** 31 registrations / 29 unique method-path pairs at the audited baseline. Two duplicate transaction GET registrations were removed in the follow-up; current route source has 29 registrations / 29 unique method-path pairs.  
**Scope:** route authentication, enterprise role, transaction assignment, site scope, public contracts, peer synchronization, CORS, and test coverage.

## Classification

| Method | Endpoint | Access contract | Scope / negative cases |
|---|---|---|---|
| GET | `/health` | Public liveness only | Must not expose node, peer, queue, retry, or conflict details |
| GET | `/api/v1/products` | Public active catalogue | Only active product fields |
| POST | `/api/v1/inquiries` | Public, rate-limited intake | Input validation; no authenticated identity implied |
| GET | `/api/v1/inquiries/:trackingCode` | Public, rate-limited tracking | Strict tracking-code format; no PII beyond response contract |
| POST | `/api/v1/sync/tenants` | Retired endpoint | Always 410; no legacy tenant replication |
| GET | `/api/v1/auth/session` | Valid Supabase bearer | Invalid/expired token 401; no user metadata privilege |
| GET | `/api/v1/enterprise/session` | Valid bearer + active configured enterprise membership | No membership 403; inactive tenant/membership denied |
| GET | `/api/v1/admin/session` | Valid bearer + server-side admin allowlist | User-editable metadata cannot grant admin |
| GET | `/api/v1/transactions` | Bearer + active enterprise + allowed role + explicit transaction assignment; enterprise admin is tenant-scoped | Cross-enterprise and unassigned rows hidden; operational roles require linked assigned site |
| GET | `/api/v1/transactions/:id` | Same as transaction list | Cross-enterprise, unassigned, revoked, and wrong-site IDs return non-disclosing 404 |
| POST | `/api/v1/transactions` | Bearer + active enterprise | Legacy write intentionally retired with 410 |
| PATCH | `/api/v1/transactions/:id/status` | Bearer + active enterprise | Legacy write intentionally retired with 410 |
| POST | `/api/v1/sync/inquiries` | Shared sync secret + configured peer identity | Missing/incorrect secret 401; unknown peer 403; invalid payload 400 |
| POST | `/api/v1/supply/sites` | Bearer + active enterprise + enterprise_admin | Other roles 403; tenant is taken from verified active context |
| POST | `/api/v1/supply/sites/:siteId/assignments` | Bearer + active enterprise + enterprise_admin | Site must be active/current-tenant; target must have active enterprise membership and compatible active role |
| DELETE | `/api/v1/supply/sites/:siteId/assignments/:userId` | Bearer + active enterprise + enterprise_admin | Only current-tenant active assignment revoked; audit write must succeed |
| POST | `/api/v1/supply/lots` | Bearer + active enterprise + enterprise_admin/supplier/warehouse + site intake scope | Site must belong to tenant, be active, match role/site-type, and be assigned unless admin |
| POST | `/api/v1/supply/lots/:lotId/inspections` | Bearer + active enterprise + enterprise_admin/qc + body site scope | Lot/site/tenant mismatch denied |
| POST | `/api/v1/supply/processing` | Bearer + active enterprise + enterprise_admin/warehouse + body site scope | Site must be active, tenant-owned, role-compatible, and assigned unless admin |
| POST | `/api/v1/supply/movements` | Bearer + active enterprise + enterprise_admin/warehouse/logistics + both source and destination site scopes | Either site outside tenant, inactive, role-incompatible, or unassigned denies |
| POST | `/api/v1/supply/evidence` | Bearer + active enterprise + enterprise_admin/buyer/seller/supplier/warehouse/qc/logistics/auditor | Service must validate entity and site scope; storage reference is not authorization |
| GET | `/api/v1/supply/stock` | Bearer + active enterprise + enterprise_admin/buyer/warehouse/qc/logistics/auditor + query site scope | Missing, foreign, inactive, or unassigned site denied |
| GET | `/api/v1/supply/lots/:lotId/trace` | Bearer + active enterprise + enterprise_admin/buyer/seller/warehouse/qc/logistics/auditor + lot-origin site scope | Foreign tenant or inaccessible origin site hidden/denied |
| POST | `/api/v1/supply/handovers` | Bearer + active enterprise + enterprise_admin/warehouse/logistics + both source and destination site scopes | Both endpoints of transfer must pass |
| POST | `/api/v1/supply/handovers/:handoverId/dispatch` | Bearer + active enterprise + enterprise_admin/logistics + source-site scope | Handover must belong to tenant; source site must be assigned |
| POST | `/api/v1/supply/handovers/:handoverId/receive` | Bearer + active enterprise + enterprise_admin/warehouse/logistics/qc + destination-site scope | Handover must belong to tenant; destination site must be assigned |
| POST | `/api/v1/transactions/:id/access-assignments` | Bearer + active enterprise + enterprise_admin | Transaction must belong to enterprise; grantee must have active enterprise role and buyer/seller side membership; operational roles require linked site |
| DELETE | `/api/v1/transactions/:id/access-assignments/:userId/:role` | Bearer + active enterprise + enterprise_admin | Only active assignment in current tenant can be revoked; audit write must succeed |
| POST | `/api/v1/transactions/:id/site-links` | Bearer + active enterprise + enterprise_admin | Transaction and active site must both belong to current tenant; audit write must succeed |

## CORS contract and browser evidence

The API's CORS middleware advertises `GET, POST, PATCH, DELETE, OPTIONS` and the request headers consumed by route logic: `Content-Type`, `Authorization`, `Idempotency-Key`, `X-Request-Id`, and `X-Active-Tenant-Id`. The synthetic suite `test/p0-cors-preflight.test.mjs` covers the server-side preflight contract, including DELETE/PATCH and allowed/unsupported request attributes.

**Real-browser evidence added by PR #128:**
- Test: `test/p0-browser-cors.e2e.mjs`; runner: Chromium via Playwright.
- Exact tested candidate SHA: `824e37cd1047158e00a7b17c9aa6762462a39c72`.
- Workflow: [P0 Browser Security E2E run 42439061375](https://github.com/muchlisbstg/export-client-mobile-sync/actions/runs/42439061375) — completed successfully.
- Allowed-origin case: a browser fetch sends non-safelisted `X-Request-Id`, causing browser-managed preflight; actual `GET /health` returns HTTP 200 with minimal `{ "status": "ok" }` body and exact allowed-origin response header.
- Hostile-origin case: browser fetch is rejected and surfaces a `TypeError`.

**Coverage boundary:** this test exercises a public health endpoint, not an authenticated business route. It does not establish complete authenticated Web login/session flows, all protected endpoints, every method/header combination in a real browser, credentialed-cookie behavior, or Android/iOS browser behavior. CORS is not authorization. The PR #128 result is evidence for its exact candidate SHA, not a fresh run on current main `79bf932b85b5e7bc618a42de8feb6565061ef869` or future commits.

## Mandatory test dimensions

1. **Authentication:** absent, malformed, invalid, and expired credentials on every protected route; sync endpoint tested against its separate peer-secret contract.
2. **Enterprise boundary:** no membership, suspended membership, wrong `x-active-tenant-id`, and tenant A attempting tenant B objects.
3. **Role boundary:** every role against allowed and denied operations; user-editable `user_metadata` must never grant roles.
4. **Site boundary:** site from another tenant, inactive site, missing assignment, revoked assignment, wrong site type, and movement/handover where only one endpoint is authorized.
5. **Transaction boundary:** buyer-side and seller-side membership, operational assignment, role mismatch, missing site link, revoked assignment, and cross-transaction IDs.
6. **Audit fail-closed:** successful and denied mutations/reads must not return success when required audit persistence fails.
7. **Public contract:** public routes remain public but rate-limited/validated; health response remains minimal; retired route remains 410.
8. **CORS:** retain synthetic preflight coverage for the declared methods/headers; extend browser tests to authenticated application requests and any additional method/header combinations actually used by Web clients.

## Current evidence and open gaps

- The endpoint auth test covers 24 protected route entries for missing, invalid, and expired bearer credentials, plus public/retired contracts.
- Existing synthetic suites cover admin metadata spoofing, enterprise membership/role denial, a subset of site/transaction scope, assignment revocation, two-sided transfer authorization, and denied-write immutability for selected supply-chain operations.
- PR #128 added real Chromium browser CORS coverage and aligned the app's health display with the minimal public liveness contract. Operational peer topology and queue metrics remain intentionally absent from public health.
- Browser workflow run `42439061375` passed on candidate SHA `824e37cd1047158e00a7b17c9aa6762462a39c72`; the test verifies browser-managed preflight followed by actual public `GET /health`, plus hostile-origin rejection. It is bounded evidence, not authenticated route coverage or a current-main rerun.
- **Not yet proven:** every endpoint × role × enterprise × site combination; all denied-write paths; audit-storage failure for every mutation; full role-revocation lifecycle across every resource.
- CI passing is necessary evidence, not independent Security approval. P0 remains **OPEN** pending exact-SHA verification and independent Security Review.


## Complete role-denial and site-scope test matrix

The following integration tests use disposable SQLite databases, synthetic identities, synthetic enterprise/site records, and the actual Express route registration. No staging or production database is used.

### Route × role denial matrix

The new test in `test/p0-role-enterprise-site.test.mjs` exercises the following endpoint policies against all eight active enterprise roles (`enterprise_admin`, `buyer`, `seller`, `supplier`, `warehouse`, `qc`, `logistics`, `auditor`):

| Endpoint | Allowed roles | Negative role assertions |
|---|---|---|
| `POST /api/v1/supply/sites` | enterprise_admin | Every non-admin role |
| `POST /api/v1/supply/sites/:siteId/assignments` | enterprise_admin | Every non-admin role |
| `DELETE /api/v1/supply/sites/:siteId/assignments/:userId` | enterprise_admin | Every non-admin role |
| `POST /api/v1/supply/lots` | enterprise_admin, supplier, warehouse | buyer, seller, qc, logistics, auditor |
| `POST /api/v1/supply/lots/:lotId/inspections` | enterprise_admin, qc | buyer, seller, supplier, warehouse, logistics, auditor |
| `POST /api/v1/supply/processing` | enterprise_admin, warehouse | buyer, seller, supplier, qc, logistics, auditor |
| `POST /api/v1/supply/movements` | enterprise_admin, warehouse, logistics | buyer, seller, supplier, qc, auditor |
| `GET /api/v1/supply/stock` | enterprise_admin, buyer, warehouse, qc, logistics, auditor | seller, supplier |
| `GET /api/v1/supply/lots/:lotId/trace` | enterprise_admin, buyer, seller, warehouse, qc, logistics, auditor | supplier |
| `POST /api/v1/supply/handovers` | enterprise_admin, warehouse, logistics | buyer, seller, supplier, qc, auditor |
| `POST /api/v1/supply/handovers/:handoverId/dispatch` | enterprise_admin, logistics | buyer, seller, supplier, warehouse, qc, auditor |
| `POST /api/v1/supply/handovers/:handoverId/receive` | enterprise_admin, warehouse, logistics, qc | buyer, seller, supplier, auditor |
| `POST /api/v1/transactions/:id/access-assignments` | enterprise_admin | Every non-admin role |
| `DELETE /api/v1/transactions/:id/access-assignments/:userId/:role` | enterprise_admin | Every non-admin role |
| `POST /api/v1/transactions/:id/site-links` | enterprise_admin | Every non-admin role |

The route-level negative matrix contains **82 expected 403 assertions**. It also checks that every active role can reach the assignment-filtered transaction list, while a user without a transaction assignment receives a non-disclosing 404 for a transaction detail.

### Evidence entity × role matrix

The route admits active enterprise roles, but the service applies a narrower entity-specific policy. The test submits a synthetic non-existent entity so role authorization is evaluated before entity lookup.

| Evidence entity | Allowed roles | Denied roles |
|---|---|---|
| lot | enterprise_admin, supplier, warehouse | buyer, seller, qc, logistics, auditor |
| inspection | enterprise_admin, qc | buyer, seller, supplier, warehouse, logistics, auditor |
| movement | enterprise_admin, warehouse, logistics | buyer, seller, supplier, qc, auditor |
| handover | enterprise_admin, warehouse, logistics | buyer, seller, supplier, qc, auditor |

This adds **32 role/entity assertions** (8 roles × 4 entity types). For allowed roles the synthetic entity is expected to return 404; for disallowed roles it must return 403.

### Transaction assignment and site-link mutations

`test/transaction-authorization.test.mjs` now verifies:
- Non-admin cannot grant transaction access (403).
- Admin can grant a role only for a current-enterprise transaction and a linked site (201).
- Admin can link a current-enterprise active site (201).
- Cross-enterprise transaction assignment is hidden (404).
- Cross-enterprise site link is hidden (404).
- Admin can revoke an exact active assignment (200).
- Revoked user loses transaction detail access immediately (404).

### Site-boundary behavioral evidence

Existing and extended synthetic tests cover:
- Lot intake: foreign-tenant, inactive, incompatible-type, and unassigned site denial.
- Inspection: an assignment at a different site cannot be substituted for the lot's actual site.
- Processing: warehouse cannot substitute an unassigned QC site.
- Movement: both source and destination require authorization.
- Handover creation: source-only assignment cannot create a transfer to an unassigned destination.
- Dispatch and receipt: source and destination authorization are checked independently.
- Stock and trace: inaccessible site/origin site is denied.
- Evidence: handover evidence is denied when the actor is not authorized for the source site.
- Site revocation and site deactivation: subsequent reads are denied.
- Denied requests leave selected inspection, movement, inventory, evidence, and handover state unchanged.

### Security review evidence index

| Evidence | File |
|---|---|
| Route authorization policy inventory | `docs/p0-api-endpoint-authorization-matrix.md` |
| Missing/invalid/expired bearer + CORS preflight | `test/p0-endpoint-auth-matrix.test.mjs` |
| Active role denial matrix + evidence entity role matrix | `test/p0-role-enterprise-site.test.mjs` |
| Cross-site denied-write and two-site transfer tests | `test/p0-cross-site-route-matrix.test.mjs` |
| Transaction assignment/site-link/read/revocation tests | `test/transaction-authorization.test.mjs` |
| Source route registration and middleware | `server/index.mjs`, `server/supply-chain-routes.mjs` |
| Enterprise authorization helper | `server/authorization.mjs` |
| Supply-chain entity/service authorization | `server/supply-chain.mjs` |

## Remaining limitations — P0 stays OPEN

The matrix now has broad negative-role and representative site-boundary integration coverage, but it is **not a full Cartesian proof of every allowed role × every resource × every site state**. The following must remain explicit review items:

1. Run all newly expanded tests on the exact resulting branch SHA and retain full logs.
2. Add positive-path tests for every allowed role on every read and mutation route, using valid synthetic resources and role-compatible sites.
3. Add systematic foreign-tenant, inactive-site, unassigned-site, and revoked-assignment cases to each individual site-bound route, not only representative route families.
4. Inject audit-table write failures for each mutation and verify transaction rollback/fail-closed behavior. Current tests prove selected audit and denied-write behavior, not every mutation's failure path.
5. Verify role revocation (enterprise role assignment) independently from site-assignment revocation for each affected route.
6. Extend browser CORS E2E beyond the currently passing public `/health` scenario to authenticated Web session/business-route requests and any additional client-used methods/headers; verify on the exact candidate SHA.
7. Obtain independent Security Review against the exact SHA. CI success is supporting evidence only and does not close P0.

No real customer data, staging database, migration, deployment, or paid infrastructure was used. No PR merge or release approval is implied by this evidence pack.


## Independent Security Review packet

**Review target (code and test changes):** `da4e64521ca39b533eff184dab43826670d0bd47`  
**Branch:** `security/p0-release-readiness-2026-11-04`  
**Draft PR:** [#119 — P0 route audit remediation and CORS contract](https://github.com/muchlisbstg/export-client-mobile-sync/pull/119)

### CI evidence for the review target

GitHub Actions run [41791223524](https://github.com/muchlisbstg/export-client-mobile-sync/actions/runs/41791223524) completed on the behavioral test source SHA:

- `npm test`: **114 passed, 0 failed**.
- `npm run typecheck`: success.
- `npx expo install --check`: success.
- Android JavaScript bundle export: success.
- Three-backend interoperability job: success.

This CI result is evidence for the tested commit only. It is not an independent security sign-off and does not establish every possible role/resource/site combination.

### Reviewer checklist and required disposition

The independent reviewer should inspect the source and test diffs at the exact review target and record:

1. Whether the route inventory is complete against all route registrations.
2. Whether every route's declared role policy matches business responsibilities and least privilege.
3. Whether site constraints are enforced using verified tenant context and current active assignments.
4. Whether two-site operations require authorization at both ends.
5. Whether transaction access requires active assignment, correct transaction side, role, and linked active site.
6. Whether denied requests are non-disclosing and leave business state unchanged.
7. Whether audit persistence is fail-closed and append-only on every relevant mutation/read.
8. Whether role, membership, site, and transaction-assignment revocation take effect immediately.
9. Whether public endpoints disclose only their intended response contract.
10. Whether browser CORS preflight and actual Web requests work with the headers and methods used by the client.

**Reviewer identity:** to be supplied by the repository owner; no independent approval is asserted here.  
**Review result:** PENDING.  
**Findings:** reviewer to append with file/line references and severity.  
**Approval SHA:** must be the exact reviewed commit, not a moving branch name.

### Explicit closure blockers

- The 114-test suite covers the implemented negative-role matrix, evidence entity-role matrix, representative site boundaries, and transaction assignment lifecycle. It does not constitute exhaustive positive-path coverage for every allowed role on every mutation/read route.
- Audit-table write-failure injection is not yet exhaustive for every mutation.
- Enterprise-role revocation is not yet independently tested against every route family.
- Site revocation/inactivation and cross-site tests are representative, not a complete per-route Cartesian matrix.
- Browser-level CORS E2E is **partially complete**: PR #128's Chromium test passed on its exact head SHA for allowed-origin preflight + actual public `/health` request and hostile-origin rejection. Authenticated Web session/business-route coverage and broader method/header coverage remain open.
- Historical note: PR #119 was previously observed as Draft with a dirty merge state. It is now **closed and not merged**; its nine changed paths are represented in the inspected main baseline. Do not treat its stale branch divergence as an active merge task or cherry-pick source.

**Disposition: P0 SECURITY OPEN.** Do not merge, deploy, migrate, or approve release on the basis of this CI run.


## Browser CORS E2E evidence update — 2026-11-08

PR #128 merged the real Chromium browser test and workflow. The exact candidate test SHA was `824e37cd1047158e00a7b17c9aa6762462a39c72`; GitHub Actions run `42439061375` (`P0 Browser Security E2E`) completed with conclusion `success`.

The test's positive path starts a local allowed web origin and API, performs browser `fetch(GET /health)` with non-safelisted `X-Request-Id`, and checks HTTP 200, the minimal health JSON, and exact `Access-Control-Allow-Origin`. Successful completion demonstrates that Chromium accepted the browser-managed preflight and the actual GET. The negative path starts a distinct hostile origin and expects the browser fetch to reject with `TypeError`.

This is not evidence of an authenticated API call, a real application login/session, all protected route families, every CORS method/header permutation, credentialed cross-origin cookies, or Android/iOS app E2E. Do not mark those dimensions complete from this run.

**Current main reference:** `79bf932b85b5e7bc618a42de8feb6565061ef869`. The browser E2E result is historical evidence on the exact PR #128 candidate SHA, not an assertion that the workflow has rerun on this current main SHA.
