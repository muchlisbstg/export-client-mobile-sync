# MOB-AUTH-ROUTE-MATRIX-001 — Mobile Authorization Route Contract

- **Status:** Draft — P0 review; not implementation approval
- **Version:** 1.0
- **Repository:** `muchlisbstg/export-client-mobile-sync`
- **Reviewed baseline:** `main` at `0a3c595c6697f56d0cef8536c3b93c3886cc5ab1`
- **Purpose:** Separate the route inventory actually found in the current source from the target authorization contract. Paths marked **Target** are proposed and are not claims about existing endpoints.

## 1. Current route inventory (source-confirmed)

Source review: `server/index.mjs` and `server/supply-chain-routes.mjs`.

| Route | Current handler location | Current middleware / guard | Assessment |
|---|---|---|---|
| `GET /api/v1/auth/session` | `server/index.mjs` | auth limiter + authentication | Identity/session endpoint |
| `GET /api/v1/enterprise/session` | `server/index.mjs` | auth limiter + authentication; checks `singleEnterpriseId` | Conflicts with multi-tenant target |
| `GET /api/v1/admin/session` | `server/index.mjs` | auth limiter + authentication + admin guard | Admin-specific; tenant scope needs explicit contract |
| `GET /api/v1/transactions` | Both route modules | authentication + active tenant + legacy role; supply route also performs transaction access filtering | Duplicate route registration; consolidate |
| `GET /api/v1/transactions/:id` | Both route modules | authentication + active tenant + legacy role; supply route also performs transaction access filtering | Duplicate route registration; consolidate |
| `POST /api/v1/transactions` | `server/index.mjs` | authentication + active tenant | Current handler returns retired/not-implemented response |
| `PATCH /api/v1/transactions/:id/status` | `server/index.mjs` | authentication + active tenant | Current handler returns retired/not-implemented response |
| `POST /api/v1/transactions/:id/access-assignments` | `server/supply-chain-routes.mjs` | auth limiter + authentication + active tenant + enterprise_admin | Legacy tenant/transaction checks; DB participant and membership constraints incomplete |
| `DELETE /api/v1/transactions/:id/access-assignments/:userId/:role` | `server/supply-chain-routes.mjs` | same as above | Must bind revoke authority to participant + membership |
| `POST /api/v1/transactions/:id/site-links` | `server/supply-chain-routes.mjs` | same as above | Must enforce site-owner approval and transaction participant relationship |
| `POST /api/v1/supply/sites` | `server/supply-chain-routes.mjs` | auth limiter + authentication + active tenant + enterprise_admin | Site owner is implicitly active tenant; make ownership explicit |
| `POST /api/v1/supply/sites/:siteId/assignments` | `server/supply-chain-routes.mjs` | same + enterprise_admin | Assignment lacks membership FK |
| `DELETE /api/v1/supply/sites/:siteId/assignments/:userId` | `server/supply-chain-routes.mjs` | same + enterprise_admin | Revocation must be tenant/member scoped |
| `POST /api/v1/supply/lots` | `server/supply-chain-routes.mjs` | secured + role + lot-intake site scope | Add transaction participant/site approval when transaction-bound |
| `POST /api/v1/supply/lots/:lotId/inspections` | same | secured + role + body-site scope | Verify QC assignment and approved transaction site |
| `POST /api/v1/supply/processing` | same | secured + role + body-site scope | Verify participant/site scope for transaction-bound work |
| `POST /api/v1/supply/movements` | same | secured + role + transfer-site scope | Verify both source and destination site authority |
| `POST /api/v1/supply/evidence` | same | secured + role | Bind evidence to authorized transaction/resource |
| `GET /api/v1/supply/stock` | same | secured + role + stock-site scope | Verify tenant/site scope and transaction visibility |
| `GET /api/v1/supply/lots/:lotId/trace` | same | secured + role + lot-site scope | Verify transaction participant visibility |
| `POST /api/v1/supply/handovers` | same | secured + role + transfer-site scope | Verify transaction and both site approvals |
| `POST /api/v1/supply/handovers/:handoverId/dispatch` | same | secured + role + from-site scope | Release authority remains a separate policy gate |
| `POST /api/v1/supply/handovers/:handoverId/receive` | same | secured + role + to-site scope | Verify receiving participant and site approval |
| `POST /api/v1/inquiries` | `server/index.mjs` | create limiter | Public inquiry intake; ownership assignment policy required |
| `POST /api/v1/sync/inquiries` | `server/index.mjs` | sync-secret validation | Service-to-service contract; tenant/event ownership validation required |
| `GET /api/v1/inquiries/:trackingCode` | `server/index.mjs` | tracking limiter | Public tracking response must disclose only permitted fields |
| `POST /api/v1/sync/tenants` | `server/index.mjs` | returns 410 | Retired endpoint; keep retired unless separately approved |

**Route-order finding:** `registerSupplyChainRoutes()` is invoked before the later index-level transaction list/detail handlers. Express may therefore match the earlier handlers first. Consolidate to one route registration per method/path; do not rely on registration order to select security policy.

## 2. Target middleware contract

| ID | Target middleware / service | Required responsibility |
|---|---|---|
| MW-01 | `authenticateRequest` | Establish authenticated identity; reject missing/invalid identity |
| MW-02 | `resolveActiveTenant` | Resolve requested tenant context for this request |
| MW-03 | `requireActiveTenant` | Verify tenant exists and is active |
| MW-04 | `requireActiveMembership` | Verify active `(tenant_id,user_id)` membership |
| MW-05 | `loadTenantRoles` | Load roles bound to the active membership |
| MW-06 | `requireTenantRole` | Enforce operation-specific role |
| MW-07 | `requireResourceOwnership` | Verify resource belongs to the active tenant or an explicitly shared scope |
| MW-08 | `requireTransactionParticipant` | Verify tenant is an explicit participant in the transaction |
| MW-09 | `requireTransactionSiteApproval` | Verify site link, purpose, owner approval, and effective status |
| MW-10 | `requireTransactionAssignment` | Verify user assignment to participant + transaction + role |
| MW-11 | `requireSiteAssignment` | Verify active user assignment to the site and membership |
| MW-12 | `requireAuthorizationAudit` | Persist required allow/deny/mutation audit; fail closed for mandatory audit |

Canonical order: MW-01 → MW-02 → MW-03 → MW-04 → MW-05 → MW-06 → MW-07 → MW-08 (when transaction-bound) → MW-09 (when site-bound) → MW-10/MW-11 (when assignment-bound) → operation → MW-12.

## 3. Target authorization matrix

| Route group | Tenant + membership | Role | Participant | Site approval | Assignment | Audit |
|---|---|---|---|---|---|---|
| Tenant session/membership | Required | Self/admin policy | N/A | N/A | N/A | Security events |
| Transaction list/detail | Required | Read role | Required per returned transaction | Filter site-derived data | Where operation requires it | Denials + sensitive reads |
| Transaction access grant/revoke | Required | Participant admin policy | Grantor must represent participant | Required if site-scoped | Grant/revoke target membership | Mandatory |
| Transaction site link/approval | Required | Site owner representative + participant policy | Required | Explicit owner approval | N/A | Mandatory |
| Supply site create/update | Required | Site-owner admin | N/A | Owner context | N/A | Mandatory |
| Supply site assignment | Required | Site-owner admin | Required if transaction-bound | Required if transaction-bound | Target user active member | Mandatory |
| Lot receipt/processing | Required | Supplier/Warehouse/approved operator | Required if transaction-bound | Required | Operation assignment | Mandatory |
| QC inspection | Required | QC | Required if transaction-bound | Required | QC assignment | Mandatory |
| Stock/movement/trace | Required | Role by operation | Required for transaction data | Source + destination as applicable | Site assignment | Mandatory for mutations |
| Handover dispatch/receive | Required | Logistics/Warehouse per operation | Required | From/to owner approvals | Relevant site assignment | Mandatory |
| Evidence write/read | Required | Role by evidence type | Required for transaction evidence | Site scope when applicable | Relevant assignment | Mandatory |
| Public inquiry intake/tracking | No tenant session for public intake only | Public contract | N/A | N/A | N/A | Abuse/privacy controls |
| Sync/webhook | Service identity | Service permission | Event participant validation | Event/site validation | Service scope | Immutable event audit |

## 4. Negative test contract

Every case must assert HTTP outcome, absence of unauthorized side effects, and audit outcome where required.

| ID | Scenario | Expected |
|---|---|---|
| MA-NEG-001 | Unauthenticated request to protected route | 401 |
| MA-NEG-002 | Unknown or inactive tenant context | 403/404; no data disclosure |
| MA-NEG-003 | User has no membership in requested tenant | 403 |
| MA-NEG-004 | Membership suspended or revoked | 403 |
| MA-NEG-005 | Tenant switch to tenant without membership | 403 |
| MA-NEG-006 | Role from tenant A reused in tenant B | 403 |
| MA-NEG-007 | Role assignment exists without active membership | DB reject / 403 |
| MA-NEG-008 | Legacy enterprise role used as sole authority | 403 |
| MA-NEG-009 | Buyer tenant equals Seller tenant | DB reject |
| MA-NEG-010 | Transaction read by non-participant tenant | 404/403 without data leak |
| MA-NEG-011 | Third party accesses transaction without participant row | 403 |
| MA-NEG-012 | Assignment tenant differs from transaction participant | DB reject |
| MA-NEG-013 | Assignment user lacks membership in participant tenant | DB reject / 403 |
| MA-NEG-014 | Duplicate Buyer or Seller participant | DB reject |
| MA-NEG-015 | Site owner tenant mismatch in site link | DB reject |
| MA-NEG-016 | External site used without owner approval | 403 |
| MA-NEG-017 | Expired, revoked, or pending site approval | 403 |
| MA-NEG-018 | Site assignment without active membership | DB reject / 403 |
| MA-NEG-019 | Site assignment points to a site in another tenant | DB reject |
| MA-NEG-020 | Source authorized but destination site unauthorized | 403; no movement |
| MA-NEG-021 | Inquiry owner inferred from email/creator/tracking code | Must not assign |
| MA-NEG-022 | Legacy inquiry has ambiguous ownership | Quarantine; inaccessible to tenant business views |
| MA-NEG-023 | Transaction linked to inquiry with inconsistent owner/participants | DB reject / 409 |
| MA-NEG-024 | Duplicate transaction route handlers remain registered | CI/static route-contract failure |
| MA-NEG-025 | Authorization audit persistence fails for mandatory mutation | 503 and transaction rollback |
| MA-NEG-026 | Membership/assignment revoked during sensitive operation | Operation rechecks/serializes; no stale authorization |
| MA-NEG-027 | Client supplies forged tenant, role, participant, or owner ID | Ignore as authority; deny if mismatch |
| MA-NEG-028 | Goods release attempted without release-policy conditions | Deny; no dispatch/release side effect |

## 5. Positive test contract

- MA-POS-001: Buyer member accesses only transactions where its tenant is Buyer participant.
- MA-POS-002: Seller member accesses only transactions where its tenant is Seller participant.
- MA-POS-003: Approved third-party tenant accesses only its explicitly assigned transaction scope.
- MA-POS-004: User with active membership in two tenants can switch context after fresh membership validation.
- MA-POS-005: Site owner approves an external transaction-site link; approved use succeeds within purpose and effective period.
- MA-POS-006: Same site is used in two transactions only with separate valid transaction-site approvals.
- MA-POS-007: Site owner revokes approval; subsequent operations are denied.
- MA-POS-008: Assignment is granted to an active member and is constrained to participant, role, transaction, and site.
- MA-POS-009: Inquiry remains owned by originating tenant until authorized transfer.
- MA-POS-010: Legacy inquiry with no reliable ownership evidence remains quarantined.
- MA-POS-011: Audit event is committed atomically with a successful sensitive mutation.
- MA-POS-012: Contract-defined release conditions are enforced independently of generic role access.

## 6. Current test evidence and gap

The current `test/supply-chain.test.mjs` includes a test explicitly named `single-enterprise RBAC restricts Buyer, Seller, Supplier, Warehouse, QC and outsiders`, and tests site assignment, revocation, cross-tenant site access, and audit failure. These are useful regression tests for the current single-enterprise behavior, but they do not prove the approved separate Buyer/Seller tenant model. They must be replaced/extended, not simply deleted.

Package script `npm test` includes dedicated files for transaction authorization, endpoint auth matrix, role/enterprise/site, cross-site route matrix, schema reconciliation, tenant migration, and supply-chain tests. No test execution or CI result is claimed by this document.

## 7. P0 exit gate

- [ ] ADR-MOB-AUTH-001 reviewed and approved as architecture contract.
- [ ] Current route inventory reconciled against every registered route.
- [ ] Duplicate transaction routes consolidated.
- [ ] Global single-enterprise authorization removed.
- [ ] Membership-bound roles and participant/site/assignment integrity implemented.
- [ ] Inquiry ownership and legacy quarantine policy implemented.
- [ ] All negative and positive cases automated and passing.
- [ ] Existing supply-chain, auth, sync, and regression tests pass.
- [ ] GitHub Actions evidence is green for the exact candidate SHA.
- [ ] No merge/deploy until explicit approval.

**Status: BLOCKED.** This is a source-based contract draft, not proof that the P0 gate has passed. It does not authorize runtime code changes, schema migrations, merge, or deployment.
