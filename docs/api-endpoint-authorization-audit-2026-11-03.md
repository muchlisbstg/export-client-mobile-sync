# API Endpoint Authorization and Site-Scope Audit

**Review date:** 3 November 2026  
**Reviewed source ref:** `main` (repository files fetched during this review)  
**Scope:** Express route declarations in `server/index.mjs` and `server/supply-chain-routes.mjs`, plus authorization helpers and service-level evidence checks.

## Executive decision

**Assessment: CORE ENTERPRISE AND SITE MIDDLEWARE IS PRESENT; POLICY AND NEGATIVE-TEST CLOSURE REMAIN OPEN.**

The route inventory below is based on static source inspection. It is not a dynamic penetration test, and it does not prove production configuration, proxy behavior, database contents, or the deployed runtime is identical to the reviewed source.

## 1. Core and public API routes

| Route | Current access control | Review result |
|---|---|---|
| `GET /api/v1/auth/session` | Rate limit + Supabase bearer verification | Identity-only endpoint; no enterprise membership is required by design. |
| `GET /api/v1/enterprise/session` | Rate limit + Supabase bearer verification + configured enterprise membership and active role resolution | Denies missing configuration/schema and inactive/unassigned members. |
| `GET /api/v1/admin/session` | Rate limit + Supabase bearer verification + server-side `ADMIN_USER_IDS` allowlist | Admin role is not taken from client-supplied metadata. |
| `GET /health` | Public liveness | Changed in this PR to return only `{status:"ok"}`; retains a database `SELECT 1` readiness probe and `Cache-Control: no-store`. |
| `POST /api/v1/sync/tenants` | No identity middleware | Retired endpoint; returns HTTP 410 without processing a payload. |
| `GET /api/v1/transactions` | Supabase auth + active enterprise + recognized enterprise role | Query is scoped to the configured enterprise via buyer/seller legacy columns. All recognized roles currently share read access; business need-to-know policy still requires sign-off. |
| `GET /api/v1/transactions/:id` | Supabase auth + active enterprise + recognized enterprise role | Detail query is enterprise-scoped and returns 404 for non-matching IDs. All recognized roles currently share read access. |
| `POST /api/v1/transactions` | Supabase auth + active enterprise | Retired write path returns HTTP 410; no transaction is created. Add a role gate when this workflow is implemented. |
| `PATCH /api/v1/transactions/:id/status` | Supabase auth + active enterprise | Retired write path returns HTTP 410; no status is changed. Add a role gate when this workflow is implemented. |
| `GET /api/v1/products` | Public read | Returns only active catalog fields (id, name, category, origin, unit). Confirm public catalog policy before real commercial launch. |
| `POST /api/v1/inquiries` | Public + in-memory IP rate limit | Intentional public RFQ intake; validates fields and active product, returns a high-entropy tracking capability. Consent, retention, abuse controls behind proxy, and customer-data governance remain open. |
| `POST /api/v1/sync/inquiries` | Shared bearer secret; configured peer allowlist when peers are configured; strict payload validation | Machine-to-machine boundary, not end-user enterprise membership. Keep secret >=32 chars, require HTTPS off loopback, configure explicit peer list, rotate/revoke credentials, and test replay/retry. |
| `GET /api/v1/inquiries/:trackingCode` | Public + in-memory IP rate limit + 24-hex tracking-code validation | Capability-based public tracking; response omits customer email/name. Keep anti-enumeration, proxy rate-limit, and `no-store` behavior under test. |

## 2. Supply-chain routes

Every route below uses the shared middleware sequence `authLimiter → auth.authenticate → requireActiveTenant`. Route-specific role and site checks are additional controls, not replacements for enterprise membership.

| Route | Role gate | Site/object scope |
|---|---|---|
| `POST /api/v1/supply/sites/:siteId/assignments` | `enterprise_admin` | Target site must be active and in the configured enterprise. |
| `DELETE /api/v1/supply/sites/:siteId/assignments/:userId` | `enterprise_admin` | Revocation query is scoped by enterprise, user, and site. |
| `POST /api/v1/supply/sites` | `enterprise_admin` | Service receives server-derived enterprise and actor IDs. |
| `POST /api/v1/supply/lots` | `enterprise_admin`, `supplier`, `warehouse` | Intake role plus active site and assignment check (admin bypass is explicit). |
| `POST /api/v1/supply/lots/:lotId/inspections` | `enterprise_admin`, `qc` | Body site must be active, enterprise-owned, role-compatible, and assigned. |
| `POST /api/v1/supply/processing` | `enterprise_admin`, `warehouse` | Body site scope check. |
| `POST /api/v1/supply/movements` | `enterprise_admin`, `warehouse`, `logistics` | Both source and destination sites are checked. |
| `POST /api/v1/supply/evidence` | Broad recognized role gate | Service validates enterprise-owned entity and its active site; route supplies a role-aware assignment callback. This is service-level enforcement and must remain covered by negative tests. |
| `GET /api/v1/supply/stock` | `enterprise_admin`, `buyer`, `warehouse`, `qc`, `logistics`, `auditor` | Query site must pass active-site, role-type, and assignment checks. |
| `GET /api/v1/supply/lots/:lotId/trace` | `enterprise_admin`, `buyer`, `seller`, `warehouse`, `qc`, `logistics`, `auditor` | Lot lookup is enterprise-scoped; origin site must pass site scope. |
| `POST /api/v1/supply/handovers` | `enterprise_admin`, `warehouse`, `logistics` | Both source and destination sites are checked. |
| `POST /api/v1/supply/handovers/:handoverId/dispatch` | `enterprise_admin`, `logistics` | Handover is enterprise-scoped; origin site assignment/type is checked. |
| `POST /api/v1/supply/handovers/:handoverId/receive` | `enterprise_admin`, `warehouse`, `logistics`, `qc` | Handover is enterprise-scoped; destination site assignment/type is checked. |

## 3. Controls observed in implementation

- Enterprise context is resolved from the verified Supabase user ID and configured `SINGLE_ENTERPRISE_ID`.
- Membership and enterprise records must be active; recognized active role assignments are loaded from server-side tables.
- Client-supplied `x-active-tenant-id` cannot switch to a different enterprise.
- Supply-chain service calls receive enterprise and actor IDs from server-side request context, not request-body tenant/actor claims.
- Site assignments are checked against the authenticated user and configured enterprise; enterprise administrators have an explicit assignment bypass.
- Evidence retrieval/creation is checked against the enterprise-owned entity and active site inside the service layer.
- Mutating supply-chain operations use database transactions and require successful audit-event writes; audit failure returns 503.
- Retired multi-enterprise synchronization and transaction writes return 410.

## 4. P0/P1 findings and acceptance actions

### P0 — Before production data or release

1. **Health disclosure remediation:** this PR removes node ID, sync enablement, peer count, pending/retrying queue counts, and conflict counts from the public response. Detailed diagnostics must use a separately authenticated operator channel; do not re-add them to public health.
2. **Commercial transaction read policy:** all recognized enterprise roles can currently list/read transaction metadata. Product/security owners must approve a least-privilege role matrix before transaction data is populated with real commercial records.
3. **Site/object negative tests:** maintain explicit cross-enterprise, unassigned-site, inactive-site, wrong-role, wrong-origin/destination, and foreign-object-ID denial tests for every route family, including evidence.
4. **Public endpoint boundary:** confirm catalog fields are approved for public exposure; document public RFQ consent/retention and tracking capability controls.
5. **Sync trust boundary:** production sync must use HTTPS, a dedicated high-entropy secret, an explicit peer allowlist, safe secret rotation, and negative tests for unknown peer/replay/duplicate/restart behavior. A shared sync secret is not a human user identity.

### P1 — Operational hardening

- Confirm reverse-proxy trust settings before relying on `req.ip` for rate limiting; untrusted forwarded headers must not control client identity.
- Move rate limiting to a shared store or gateway if multiple API instances are used; current in-memory counters are process-local.
- Add operator-only diagnostics for peer health, retry queues, and conflict counts.
- Review log redaction, request IDs, public error behavior, TLS termination, and monitoring.
- Verify exact deployed source SHA and runtime configuration before treating this repository audit as evidence of production controls.

## 5. Existing test evidence and gaps

The repository includes tests for authentication, enterprise authorization, active/revoked memberships and roles, single-enterprise context locking, cross-tenant supply-chain access, role boundaries across Buyer/Seller/Supplier/Warehouse/QC, held lots, transfers, handovers, and evidence-related service behavior.

The health response test is updated in this PR to assert the public response contains only `status`, with `Cache-Control: no-store`. Queue and conflict assertions are moved to direct test-database inspection so internal operational counters are no longer part of the public HTTP contract.

**Not yet established by this static audit:** full dynamic coverage of every HTTP route under every role/site permutation, deployed API identity, proxy rate-limit behavior, live database state, or production authorization configuration.

## Release decision

**NOT CLEARED FOR PRODUCTION CUSTOMER DATA.** Merge/release requires green CI on the exact candidate SHA, reviewer approval of transaction read policy and public RFQ/catalog exposure, complete route-specific negative integration tests, deployed-runtime verification, synthetic staging acceptance, backup/restore evidence, and explicit human approval. This report does not authorize production data export, schema changes, migration, deployment, or automatic merge.
