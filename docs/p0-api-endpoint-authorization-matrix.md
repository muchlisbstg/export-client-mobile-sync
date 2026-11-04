# P0 API endpoint authorization matrix

**Baseline:** `cf773250492c669b3fe5da2bbc4f6f4d4c594f87`  
**Inventory method:** static extraction from `server/index.mjs` and `server/supply-chain-routes.mjs`, cross-checked against middleware registration.  
**Scope:** all 31 route registrations, 29 unique method/path pairs. The two transaction GET routes are registered in both modules; the earlier supply-chain registration handles the request.

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
| POST | `/api/v1/supply/sites/:siteId/assignments` | Bearer + active enterprise + enterprise_admin | Site must be active and in current tenant; audit write must succeed |
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

## Mandatory test dimensions

1. **Authentication:** absent, malformed, invalid, and expired credentials on every protected route; sync endpoint tested against its separate peer-secret contract.
2. **Enterprise boundary:** no membership, suspended membership, wrong `x-active-tenant-id`, and tenant A attempting tenant B objects.
3. **Role boundary:** every role against allowed and denied operations; user-editable `user_metadata` must never grant roles.
4. **Site boundary:** site from another tenant, inactive site, missing assignment, revoked assignment, wrong site type, and movement/handover where only one endpoint is authorized.
5. **Transaction boundary:** buyer-side and seller-side membership, operational assignment, role mismatch, missing site link, revoked assignment, and cross-transaction IDs.
6. **Audit fail-closed:** successful and denied mutations/reads must not return success when required audit persistence fails.
7. **Public contract:** public routes remain public but rate-limited/validated; health response remains minimal; retired route remains 410.

## Current evidence and open gaps

The inherited P0 test covers only nine protected route entries for absent/invalid/expired tokens, admin metadata spoofing, and allowlist success. Existing SEC-03 tests cover a subset of transaction assignments and projections. This matrix is the complete static inventory; it is **not** proof that every role/site/tenant negative case has been dynamically exercised.

The follow-up CI test enumerates all 24 unique protected route pairs for missing and invalid credentials and separately asserts the public/retired contracts. Role/site/tenant combinations remain additional acceptance tests and require independent Security review before P0 closure.
