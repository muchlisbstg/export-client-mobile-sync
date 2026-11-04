# Endpoint Authorization Matrix

**Repository:** `muchlisbstg/export-client-mobile-sync`  
**Baseline:** `main` at `73e75edad71c5a6f8819e80c5ffdeabf32314c3d`  
**Working branch:** `release-readiness/p0-expo58-schema-blueprint-2026-11-04`  
**Status:** Technical matrix; independent Security review pending; P0 remains OPEN.

This matrix is derived from route registration in `server/index.mjs` and `server/supply-chain-routes.mjs`. It describes application-layer authorization. It does not prove the deployed process, database file, reverse proxy, or production environment matches this source.

## Public endpoints

| Method and route | Purpose | Required controls | Negative / regression coverage |
|---|---|---|---|
| GET `/health` | Liveness only | No authentication; response must remain `{status:"ok"}`; `Cache-Control: no-store`; no node, peer, queue, retry, or conflict metadata | `p0-health-cors-contract.test.mjs` |
| GET `/api/v1/products` | Public active catalog | Return active products only; no enterprise-private fields | `server.test.mjs`, `api.test.mjs` |
| POST `/api/v1/inquiries` | Public inquiry intake | Rate limit; strict input validation; referenced product must be active; bounded JSON body | `rfq-validation.test.mjs`, `server.test.mjs` |
| GET `/api/v1/inquiries/:trackingCode` | Public inquiry tracking | High-entropy tracking code is a bearer capability; format validation; rate limit; return only tracking projection | `server.test.mjs`, `api.test.mjs` |

## Identity and enterprise endpoints

| Method and route | Authentication | Enterprise / role authorization | Resource boundary |
|---|---|---|---|
| GET `/api/v1/auth/session` | Valid Supabase bearer token | Identity only; no role elevation | `Cache-Control: no-store` |
| GET `/api/v1/enterprise/session` | Valid Supabase bearer token | Active membership in configured single enterprise and at least one recognized active enterprise role | Reject caller-supplied enterprise override; no-store response |
| GET `/api/v1/admin/session` | Valid Supabase bearer token | Server-side admin allowlist; user-editable metadata is not authority | No-store response |

## Transaction endpoints

| Method and route | Authentication | Role gate | Resource / assignment boundary |
|---|---|---|---|
| GET `/api/v1/transactions` | Bearer + active enterprise | Admin, buyer, seller, supplier, warehouse, QC, logistics, auditor | Non-admin sees only transactions with active explicit access assignment; buyer/seller side membership or operational role + linked site + active site assignment is rechecked |
| GET `/api/v1/transactions/:id` | Bearer + active enterprise | Same transaction role set | Same assignment checks; foreign, unassigned, revoked, or out-of-scope transaction is denied |
| POST `/api/v1/transactions` | Bearer + active enterprise | No write role; legacy route retired | Returns 410 |
| PATCH `/api/v1/transactions/:id/status` | Bearer + active enterprise | No write role; legacy route retired | Returns 410 |
| POST `/api/v1/transactions/:id/access-assignments` | Bearer + active enterprise | Enterprise admin only | Transaction must belong to enterprise; target must have active enterprise role; buyer/seller role must match transaction side membership; operational role requires a site linked to transaction |
| DELETE `/api/v1/transactions/:id/access-assignments/:userId/:role` | Bearer + active enterprise | Enterprise admin only | Revocation scoped by enterprise, transaction, user, role; next request must re-evaluate current assignment |
| POST `/api/v1/transactions/:id/site-links` | Bearer + active enterprise | Enterprise admin only | Transaction and active site must belong to enterprise; purpose allowlist enforced |

## Supply-chain endpoints

| Method and route | Authentication | Role gate | Site / resource gate |
|---|---|---|---|
| POST `/api/v1/supply/sites` | Bearer + active enterprise | Enterprise admin | Site type and site fields validated |
| POST `/api/v1/supply/sites/:siteId/assignments` | Bearer + active enterprise | Enterprise admin | Target must be active enterprise member with an active role compatible with site type |
| DELETE `/api/v1/supply/sites/:siteId/assignments/:userId` | Bearer + active enterprise | Enterprise admin | Revoke only active assignment in configured enterprise |
| POST `/api/v1/supply/lots` | Bearer + active enterprise | Admin, supplier, warehouse | Active site, compatible role, active user-site assignment; admin bypass is explicit |
| POST `/api/v1/supply/lots/:lotId/inspections` | Bearer + active enterprise | Admin, QC | Body site must be active, compatible, assigned, and scoped to lot |
| POST `/api/v1/supply/processing` | Bearer + active enterprise | Admin, warehouse | Body site must be active, compatible, assigned |
| POST `/api/v1/supply/movements` | Bearer + active enterprise | Admin, warehouse, logistics | Both source and destination sites must independently pass authorization |
| POST `/api/v1/supply/evidence` | Bearer + active enterprise | Role depends on entity type | Entity must exist in enterprise; service checks entity type, role, active site, and site assignment |
| GET `/api/v1/supply/stock` | Bearer + active enterprise | Admin, buyer, warehouse, QC, logistics, auditor | Requested site must be active, role-compatible, and assigned |
| GET `/api/v1/supply/lots/:lotId/trace` | Bearer + active enterprise | Admin, buyer, seller, warehouse, QC, logistics, auditor | Lot origin site must be active, role-compatible, and assigned |
| POST `/api/v1/supply/handovers` | Bearer + active enterprise | Admin, warehouse, logistics | Both source and destination sites must pass authorization |
| POST `/api/v1/supply/handovers/:handoverId/dispatch` | Bearer + active enterprise | Admin, logistics | Handover source-site assignment is rechecked |
| POST `/api/v1/supply/handovers/:handoverId/receive` | Bearer + active enterprise | Admin, warehouse, logistics, QC | Handover destination-site assignment is rechecked |

## Synchronization endpoints

| Method and route | Authentication | Additional controls |
|---|---|---|
| POST `/api/v1/sync/inquiries` | Service-to-service bearer secret | Configured peer identity/allowlist, payload validation, product consistency, idempotency/conflict handling; never treat peer secret as an end-user login |
| POST `/api/v1/sync/tenants` | None; retired route | Always returns 410; multi-enterprise sync is not enabled |

## Cross-cutting controls

- All private routes require a valid bearer token, active membership in the configured enterprise, and an active recognized role before role-specific authorization.
- The enterprise context is fixed by server configuration. A conflicting `x-active-tenant-id` is rejected.
- Site scope is checked on each request; role and assignment revocation must take effect on the next request.
- Denied writes must not mutate inventory, inspection, handover, evidence, or transaction records.
- Audit-write failure must fail closed for operations that require an audit record.
- Browser CORS is restricted to configured origins. Preflight permits only application methods (`GET, POST, PATCH, DELETE, OPTIONS`) and required headers (`Content-Type, Authorization, X-Active-Tenant-Id`).
- Public health is intentionally liveness-only. Peer topology and queue state are not exposed on a public endpoint.

## Route inventory caveat

The source currently contains duplicate GET registrations for `/api/v1/transactions` and `/api/v1/transactions/:id`: the assignment-aware handlers are registered by `registerSupplyChainRoutes` before older broad handlers in `server/index.mjs`. The first handlers terminate the request, so the later handlers are shadowed in the current registration order. This should be removed in a follow-up cleanup to avoid order-dependent route ambiguity; it is not counted as a second API contract.

## Verification status

- Missing, invalid, and expired bearer tests cover the protected method/path matrix.
- Enterprise, role, site, and cross-site tests use synthetic identities and databases.
- Assignment target validation has positive and negative tests.
- Cross-site tests assert denied operations do not mutate business records.
- This branch adds health privacy, CORS preflight, and immediate role/site revocation tests.
- Automated CI success is not independent Security approval. P0 remains OPEN until Security and Database reviewers record approval against the final SHA.
