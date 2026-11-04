# P0 API endpoint authorization matrix

**Reviewed against main baseline:** `73e75edad71c5a6f8819e80c5ffdeabf32314c3d` (2026-11-04)  
**Source files:** `server/index.mjs`, `server/auth.mjs`, `server/authorization.mjs`, `server/supply-chain-routes.mjs`  
**Dynamic negative-test inventory:** `test/p0-endpoint-auth-matrix.test.mjs` (24 protected method/path pairs), `test/p0-role-enterprise-site.test.mjs`, `test/p0-cross-site-route-matrix.test.mjs`, `test/security-authorization-remediation.test.mjs`, `test/transaction-authorization.test.mjs`.  
**Important:** this is a source-derived access contract. It is not a claim that every role × endpoint × enterprise × site combination has already been exercised.

## Endpoint matrix

| Method | Endpoint | Access contract | Required denial / regression cases |
|---|---|---|---|
| GET | `/health` | Public liveness only | Response remains minimal; no node, peer, queue, retry, conflict, or secret details |
| GET | `/api/v1/products` | Public active catalogue | Inactive products excluded; only approved catalogue fields returned |
| POST | `/api/v1/inquiries` | Public, rate-limited intake | Invalid body 400; inactive/unknown product 404; no implicit authenticated identity |
| GET | `/api/v1/inquiries/:trackingCode` | Public, rate-limited tracking | Invalid/unknown tracking code non-disclosing; response contract contains no unnecessary PII |
| POST | `/api/v1/sync/tenants` | Retired endpoint | Always 410; no legacy multi-enterprise replication |
| GET | `/api/v1/auth/session` | Valid Supabase bearer | Missing, malformed, invalid, expired token 401; provider unavailable 503 |
| GET | `/api/v1/enterprise/session` | Valid bearer + active configured enterprise membership | Missing/inactive/suspended membership 403; schema/config unavailable 503 |
| GET | `/api/v1/admin/session` | Valid bearer + server-side admin allowlist | User-editable metadata cannot grant platform admin; ordinary user 403 |
| GET | `/api/v1/transactions` | Bearer + active enterprise + allowed role + transaction assignment; admin remains tenant-scoped | Unassigned, revoked, wrong-side, and cross-enterprise records hidden |
| GET | `/api/v1/transactions/:id` | Same as transaction list | Cross-enterprise/unassigned/revoked/wrong-site IDs return non-disclosing 404 |
| POST | `/api/v1/transactions` | Bearer + active enterprise | Legacy write intentionally retired with 410 |
| PATCH | `/api/v1/transactions/:id/status` | Bearer + active enterprise | Legacy write intentionally retired with 410 |
| POST | `/api/v1/sync/inquiries` | Shared sync secret + configured peer identity | Missing/incorrect secret 401; unknown peer 403; invalid payload 400; sync disabled 503 |
| POST | `/api/v1/supply/sites` | Bearer + active enterprise + enterprise_admin | Other roles 403; tenant comes only from verified context |
| POST | `/api/v1/supply/sites/:siteId/assignments` | Bearer + active enterprise + enterprise_admin | Foreign/inactive site denied; audit write must succeed |
| DELETE | `/api/v1/supply/sites/:siteId/assignments/:userId` | Bearer + active enterprise + enterprise_admin | Only current-tenant assignment revoked; audit write must succeed |
| POST | `/api/v1/supply/lots` | Bearer + active enterprise + enterprise_admin/supplier/warehouse + intake site scope | Foreign/inactive/unassigned/wrong-type site denied |
| POST | `/api/v1/supply/lots/:lotId/inspections` | Bearer + active enterprise + enterprise_admin/qc + lot/site scope | Foreign lot, wrong site, or unassigned site denied |
| POST | `/api/v1/supply/processing` | Bearer + active enterprise + enterprise_admin/warehouse + body site scope | Foreign/inactive/unassigned/wrong-type site denied |
| POST | `/api/v1/supply/movements` | Bearer + active enterprise + enterprise_admin/warehouse/logistics + both site scopes | Either source or destination outside scope denies whole operation |
| POST | `/api/v1/supply/evidence` | Bearer + active enterprise + allowed operational roles | Entity, tenant, and site relationship validated; storage URI alone grants no access |
| GET | `/api/v1/supply/stock` | Bearer + active enterprise + enterprise_admin/buyer/warehouse/qc/logistics/auditor + query site scope | Missing/foreign/inactive/unassigned site denied |
| GET | `/api/v1/supply/lots/:lotId/trace` | Bearer + active enterprise + enterprise_admin/buyer/seller/warehouse/qc/logistics/auditor + lot-origin site scope | Foreign tenant or inaccessible origin site hidden/denied |
| POST | `/api/v1/supply/handovers` | Bearer + active enterprise + enterprise_admin/warehouse/logistics + both site scopes | Both source and destination must be active, tenant-owned, role-compatible, and assigned |
| POST | `/api/v1/supply/handovers/:handoverId/dispatch` | Bearer + active enterprise + enterprise_admin/logistics + source-site scope | Foreign handover or missing source assignment denied |
| POST | `/api/v1/supply/handovers/:handoverId/receive` | Bearer + active enterprise + enterprise_admin/warehouse/logistics/qc + destination-site scope | Foreign handover or missing destination assignment denied |
| POST | `/api/v1/transactions/:id/access-assignments` | Bearer + active enterprise + enterprise_admin | Transaction must belong to enterprise; grantee must have active role and correct party/site relation |
| DELETE | `/api/v1/transactions/:id/access-assignments/:userId/:role` | Bearer + active enterprise + enterprise_admin | Only active assignment in current tenant revoked; audit write must succeed |
| POST | `/api/v1/transactions/:id/site-links` | Bearer + active enterprise + enterprise_admin | Transaction and active site must both belong to current tenant; audit write must succeed |

The inventory above contains 29 unique method/path pairs. Route registrations may exceed unique pairs where a route is registered in more than one module; verify registration order before changing a route.

## Required negative and regression dimensions

1. **Authentication:** absent, malformed, invalid, and expired bearer credentials on every protected method/path; sync secret and peer identity tested separately.
2. **Enterprise boundary:** no membership, suspended membership, inactive enterprise, wrong `x-active-tenant-id`, and cross-enterprise object IDs.
3. **Role boundary:** all eight roles (`enterprise_admin`, `buyer`, `seller`, `supplier`, `warehouse`, `qc`, `logistics`, `auditor`) against permitted and forbidden operations; client metadata never grants roles.
4. **Site boundary:** foreign tenant, inactive site, no assignment, revoked assignment, wrong site type, and operations where only one side of a transfer/handover is authorized.
5. **Transaction boundary:** buyer/seller party membership, explicit transaction assignment, operational site link, role mismatch, missing/revoked assignment, and cross-transaction IDs.
6. **Mutation integrity:** denied requests do not create or mutate lots, inspections, stock movements, inventory entries, handovers, or evidence.
7. **Audit fail-closed:** protected mutations do not report success if mandatory audit persistence fails; append-only audit invariants remain intact.
8. **Public contract:** public routes remain explicitly public, rate-limited and validated; health stays minimal; retired routes remain 410.

## Existing test coverage (source inventory)

| Test file | Coverage represented |
|---|---|
| `test/p0-endpoint-auth-matrix.test.mjs` | 24 protected method/path pairs × missing credentials; invalid and expired credentials; public/retired endpoint contracts |
| `test/security-authorization-remediation.test.mjs` | Protected surfaces, metadata spoofing, explicit server-side admin allowlist |
| `test/p0-role-enterprise-site.test.mjs` | Role, active membership, tenant context, site type, assignment, and transaction-assignment denial cases |
| `test/p0-cross-site-route-matrix.test.mjs` | Cross-site route denial and no-side-effect assertions; handover/evidence site boundaries |
| `test/transaction-authorization.test.mjs` | Transaction role/assignment/site projection, revocation, cross-enterprise denial, append-only audit |

A previous PR description records a focused run with 110 passing tests and a separate authorization-matrix workflow success. Those are historical PR evidence, not a fresh result for the release-readiness branch. This branch's CI run is the acceptance evidence for this candidate SHA.

## P0 closure gate

P0 remains **OPEN** until all of the following are true:

- [ ] Complete route inventory is rechecked against the candidate source SHA.
- [ ] All relevant negative and regression tests pass on that exact SHA.
- [ ] Role × enterprise × site coverage has no unexplained endpoint gaps.
- [ ] Security reviewer approves the route policy and fail-closed behavior.
- [ ] Database reviewer approves the schema/constraint contract separately.
- [ ] PostgreSQL RLS and constraint behavior are tested independently before migration consideration.
- [ ] No staging mutation, operational-data export, merge, or production deployment is inferred from CI success.
