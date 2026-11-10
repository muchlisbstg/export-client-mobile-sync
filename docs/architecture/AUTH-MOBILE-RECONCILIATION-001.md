# AUTH-MOBILE-RECONCILIATION-001
## Mobile Multi-Tenant Identity & Authorization Specification

| Metadata | Value |
|---|---|
| Document ID | AUTH-MOBILE-RECONCILIATION-001 |
| Product | Export Client |
| Platform | Mobile API and client authorization contract |
| Related baseline | UI-INVENTORY-P0-001 |
| Domain decision | ADR-P0-TENANT-001 |
| Related documents | ADR-MOB-AUTH-001; MOB-AUTH-ROUTE-MATRIX-001 |
| Status | APPROVED — ARCHITECTURE BASELINE |
| Version | 1.0 |
| Repository | muchlisbstg/export-client-mobile-sync |
| Reference branch | docs/p0-mobile-auth-reconciliation |
| Source baseline reviewed | main @ 0a3c595c6697f56d0cef8536c3b93c3886cc5ab1 |
| Implementation authorization | NOT GRANTED |

> Approval applies to the architecture and authorization contract in this document. It does not authorize runtime code changes, database DDL, migrations, production-data changes, merge, or deployment. Those activities require separate explicit approval.

## 1. Purpose and scope

This specification reconciles Mobile identity and authorization with the approved Buyer–Seller multi-tenant domain model. It is the prerequisite for the Web–Mobile–Desktop navigation/role matrix and screen specifications.

It defines:
- User identity and authentication boundary.
- Tenant membership and lifecycle.
- Active tenant context.
- Role and permission evaluation.
- Transaction participant access.
- Site and warehouse assignment.
- Route authorization contract.
- Negative-access security matrix.
- Audit, legacy-data, and migration-readiness requirements.

This is an architecture and product contract, not an implementation plan or evidence that the current application already complies.

## 2. Approved domain principles

1. Buyer and Seller are separate tenants with isolated internal data.
2. Each tenant owns its users' memberships, roles, sites, warehouses, and internal resources.
3. A commercial transaction explicitly identifies its Buyer and Seller participants.
4. Third parties participate only through explicit, authorized transaction relationships.
5. Cross-tenant access is denied by default and granted only through explicit transaction/resource relationships and permissions.
6. Server-side authorization is authoritative and fail-closed.
7. Inquiry ownership remains with its originating tenant unless an authorized, auditable transfer occurs.
8. Legacy records without reliable ownership evidence are quarantined; ownership is never inferred from email, organization name, creator, or tracking code.
9. Signed contract snapshot is the source of truth for contractual agreement; payment ledger for settlement; evidence register for fulfillment; server-side authorization for goods release.
10. This specification does not alter the approved transaction-scope rule: either party may unilaterally suspend/withdraw consent before signing; activation/reactivation requires bilateral approval.

## 3. Current-state findings

The source audit identified a single-enterprise Mobile authorization model, including `SINGLE_ENTERPRISE_ID`, `requireActiveEnterprise()`, and the legacy enterprise session concept. The current route inventory also identifies transaction handlers in both `server/supply-chain-routes.mjs` and `server/index.mjs`, creating a route-order/duplicate-handler risk.

The route matrix separately records current source-confirmed endpoints and proposed target middleware. Some transaction write and tenant-sync endpoints are retired (HTTP 410). Existing supply-chain API coverage does not prove that the approved Buyer–Seller tenant model is enforced.

Therefore:
- The current single-enterprise model is not an acceptable target authorization authority.
- UI visibility or client-side role checks must never be treated as security controls.
- Existing tests for single-enterprise behavior are regression evidence only and must be replaced/extended to test separate tenant contexts.
- No runtime or database change is implied by this document.

## 4. Identity model

### 4.1 Identity entities

| Concept | Responsibility |
|---|---|
| User | Stable internal user identity |
| External identity | Provider-specific subject mapped to the internal user |
| Session | Authenticated session and revocation state |
| Tenant | Buyer, Seller, or approved third-party organization boundary |
| Tenant membership | Explicit relationship between a user and a tenant |
| Role assignment | Tenant-scoped role grant bound to a membership |

### 4.2 Identity rules

1. A user has a stable internal identifier independent of email.
2. External provider identities map explicitly to an internal user.
3. Email, email domain, display name, and organization label are not authorization keys.
4. One user may have memberships in multiple tenants.
5. Authentication proves identity only; it does not grant tenant access.
6. A valid session does not imply membership in any particular tenant.
7. Identity linking, unlinking, and recovery are auditable security events.

## 5. Tenant membership

### 5.1 Required membership attributes

| Attribute | Requirement |
|---|---|
| membership_id | Stable membership identifier |
| tenant_id | Tenant scope |
| user_id | Internal user identity |
| status | pending, active, suspended, or revoked |
| effective_from | Start of validity |
| effective_until | Optional end of validity |
| created_at / updated_at | Lifecycle timestamps |
| created_by / changed_by | Auditable actor references where applicable |

The authoritative relationship is the tenant/user membership pair. Database constraints must prevent role assignments and operational assignments from referring to a non-existent or mismatched membership.

### 5.2 Membership policy

- Only active membership grants tenant access.
- Pending, suspended, revoked, expired, missing, or ambiguous membership fails closed.
- A role cannot reactivate a membership.
- Membership in Tenant A grants no access to Tenant B.
- Membership changes and revocation must be auditable.
- Revocation must invalidate subsequent requests and stale authorization context.
- A user with multiple memberships must revalidate the selected membership when switching tenant.

## 6. Tenant context

### 6.1 Resolution sequence

```text
Authenticated session
        |
        v
Resolve internal user
        |
        v
Load eligible memberships
        |
        v
Select requested tenant context
        |
        v
Validate tenant and active membership
        |
        v
Load membership-bound roles/permissions
        |
        v
Build request-scoped authorization context
        |
        v
Evaluate resource, transaction, and site scopes
        |
        v
Allow or deny
```

### 6.2 Context contract

The server-side context must identify, at minimum:
- user_id
- tenant_id
- membership_id
- session_id
- membership status
- membership-bound role assignments
- resolved permissions
- context/version or equivalent invalidation marker

Transaction, participant, site, and assignment scopes are resolved for the specific operation; they must not be assumed globally from the active tenant.

### 6.3 Context security rules

1. A client-supplied tenant identifier is a selector, never proof of authority.
2. The server validates the tenant is active and the authenticated user has active membership.
3. Every tenant-scoped request is independently checked against the current authorization state.
4. Tenant switching requires fresh membership and permission resolution.
5. A context from a prior tenant must not be reused after switching.
6. Revoked memberships/assignments and expired approvals invalidate subsequent operations.
7. Cached permissions are optimizations only; they cannot override authoritative server checks.
8. Missing or unavailable authorization dependencies fail closed.

## 7. Role and permission model

### 7.1 Candidate role families

| Role family | Scope | Typical responsibility |
|---|---|---|
| Buyer Authorized Representative | Buyer tenant | Buyer-side authorized decisions |
| Buyer Procurement / Commercial | Buyer tenant | Procurement, inquiry, commercial workflow |
| Buyer Finance | Buyer tenant | Buyer-side financial review |
| Seller Authorized Representative | Seller tenant | Seller-side authorized decisions |
| Seller Sales / Commercial | Seller tenant | Offers and commercial workflow |
| Seller Finance | Seller tenant | Seller-side financial review |
| Supplier Operator | Supplier tenant or approved participant | Supply operations |
| Warehouse Operator | Tenant + assigned site | Warehouse operations |
| QC Inspector | Tenant + assigned site | Inspection and QC |
| Logistics Operator | Tenant + assigned site | Dispatch, transport, and receiving |
| Tenant Administrator | One tenant | Membership and tenant administration |
| Platform Administrator | Platform scope | Platform administration under explicit policy |
| Compliance Auditor | Explicit audit scope | Compliance review |
| Syariah Reviewer | Explicit review scope | Syariah governance review |

Role names are classifications, not grants. Final role catalog and delegation rules remain subject to a separate policy decision where needed.

### 7.2 Permission naming

Use resource/action permissions, for example:
- `catalog:read`
- `inquiry:create`, `inquiry:read`, `inquiry:transfer`
- `transaction:read`, `transaction:approve`, `transaction:suspend`
- `contract:read`, `contract:sign`
- `payment:read`, `payment:verify`
- `inventory:read`, `inventory:move`
- `qc:inspect`
- `shipment:dispatch`, `shipment:receive`
- `audit:read`
- `tenant:manage_members`

### 7.3 Authorization decision

A protected operation is allowed only when all applicable checks succeed:

1. Valid authentication.
2. Active tenant.
3. Active user membership in that tenant.
4. Permission for the requested action.
5. Resource ownership or explicit resource-sharing relationship.
6. Explicit transaction participant relationship for transaction-scoped data.
7. Valid transaction-site approval where site use is transaction-bound.
8. Active user assignment to the relevant site/transaction/role where required.
9. Resource lifecycle state permits the action.
10. Contractual, legal, financial, and Syariah policy gates are satisfied where applicable.
11. Required audit evidence can be persisted.

A matching role alone is never sufficient.

## 8. Transaction participant authorization

### 8.1 Participant model

Every commercial transaction identifies:
- Exactly one Buyer tenant participant.
- Exactly one Seller tenant participant.
- Zero or more additional explicitly authorized participants, where the domain permits them.

Buyer and Seller tenant identifiers must be distinct. Third parties such as suppliers, warehouse operators, QC providers, logistics providers, and auditors receive only the transaction scope explicitly granted to them.

### 8.2 Participant rules

1. A user acts for a participant only through active membership in that participant tenant.
2. The user must also hold the permission and transaction assignment required for the requested operation.
3. Transaction visibility is limited to transactions in which the user's active tenant is an authorized participant.
4. A participant relationship does not grant unrestricted access to the other party's internal tenant resources.
5. Client-supplied participant identifiers are never proof of participation.
6. Participant creation, replacement, and revocation follow an auditable authorized workflow.
7. Transaction access assignments must reference a valid participant and active membership in that participant tenant.

### 8.3 Contract and release authority

- Signed contract snapshot is the contractual source of truth.
- Payment ledger is the financial settlement source of truth.
- Evidence register is the fulfillment source of truth.
- Seller Authorized Representative issues/confirms release instruction.
- Buyer approval is required for goods release only when the signed contract snapshot or applicable law makes it a condition.
- Goods release is decided by server-side authorization, not by a client role or screen state.
- Contract scope activation/reactivation requires bilateral approval under the approved domain decision.
- Either party may unilaterally suspend/withdraw consent before signing, subject to the agreed transaction-scope rules.

## 9. Site and warehouse assignment

### 9.1 Ownership and relationship

Every site has one explicit owning tenant. Warehouse resources inherit or explicitly declare their tenant/site scope. A site can participate in multiple transactions only through explicit transaction-site relationships.

A transaction-site relationship must record the transaction, site, participant/owner context, purpose, approval status, approving authority, and effective period as applicable.

### 9.2 Access requirements

A site-bound operation requires:
- Active user identity and tenant membership.
- Permission for the operation.
- Site ownership or explicit transaction-site approval.
- Active user assignment to the site.
- Transaction participant and transaction assignment checks when transaction-bound.
- Active site and assignment status.
- Source and destination authorization for movements/transfers.

Site ownership, transaction-site approval, user assignment, and transaction participation are separate checks. None substitutes for another.

### 9.3 Integrity requirements

The schema design must enforce, using suitable composite keys/foreign keys or equivalent integrity controls:
- Site → owning tenant.
- Warehouse → owning tenant/site.
- User site assignment → active tenant membership.
- User site assignment → site in the same tenant scope.
- Transaction assignment → valid transaction participant.
- Transaction assignment → active membership in the participant tenant.
- Transaction-site link → transaction and site.
- Transaction-site link → authorized participant/owner relationship.

Final key definitions and DDL belong to the later schema specification and are not authorized here.

## 10. Route authorization contract

The following is a policy contract, not a claim that every endpoint currently exists.

| Route family | Authentication | Membership/context | Additional authorization |
|---|---|---|---|
| `/api/v1/auth/session/*` | Required | Resolve identity only | Session lifecycle policy |
| `/api/v1/tenant/*` | Required | Required | Self/admin membership policy |
| `/api/v1/catalog/*` | Required or explicitly public policy | Policy-based | Tenant visibility; transaction scope if applicable |
| `/api/v1/inquiries/*` | Per endpoint | Required for tenant-owned data | Inquiry owner and transfer policy |
| `/api/v1/transactions/*` | Required | Required | Participant, permission, lifecycle, audit |
| `/api/v1/contracts/*` | Required | Required | Participant, representative authority, contract state |
| `/api/v1/sites/*` | Required | Required | Site owner, site assignment, approval |
| `/api/v1/supply/lots/*` | Required | Required | Tenant/resource ownership, site, transaction if applicable |
| `/api/v1/supply/inspection/*` | Required | Required | QC permission and site assignment |
| `/api/v1/supply/inventory/*` | Required | Required | Warehouse/site, transaction and source/destination scope |
| `/api/v1/supply/handovers/*` | Required | Required | Transaction participant, site approvals, dispatch/receive authority |
| `/api/v1/shipments/*` | Required | Required | Transaction, site, logistics assignment, release policy |
| `/api/v1/audit/*` | Required | Explicit audit scope | Least-privilege audit permission |
| `/api/v1/sync/*` | Service/user identity as defined | Event tenant validation | Service permission, participant/site scope, event audit |

### 10.1 Canonical server pipeline

1. Authenticate request.
2. Resolve internal identity.
3. Resolve and validate requested tenant.
4. Verify active membership.
5. Load membership-bound roles and permissions.
6. Resolve resource and verify ownership.
7. Verify transaction participant when applicable.
8. Verify transaction-site approval when applicable.
9. Verify transaction/site assignment when applicable.
10. Evaluate operation and lifecycle policy.
11. Execute mutation atomically with required audit evidence.
12. Fail closed if a mandatory authorization or audit dependency is unavailable.

### 10.2 Route implementation controls

- Each method/path has one authoritative route handler and one explicit middleware chain.
- Duplicate transaction route registrations must be consolidated.
- Route order must never act as an authorization control.
- No protected endpoint may rely only on authentication.
- Error responses must not disclose cross-tenant resource details.
- Suggested outcomes: 401 for invalid/missing authentication; 403 for denied authorization; 404 where existence must not be disclosed; 409 for state/relationship conflicts; 503 when a mandatory authorization dependency is unavailable.
- Retired endpoints returning 410 remain unavailable until separately approved and implemented.

## 11. Negative-access security matrix

Each test must assert the HTTP/result contract, absence of unauthorized side effects, and required audit outcome.

| ID | Negative scenario | Expected result |
|---|---|---|
| NEG-001 | Unauthenticated access to protected route | 401 |
| NEG-002 | Unknown/inactive tenant context | Deny; no data disclosure |
| NEG-003 | User has no membership in requested tenant | 403 |
| NEG-004 | Membership pending, suspended, revoked, or expired | 403 |
| NEG-005 | Tenant switch to tenant without membership | 403 |
| NEG-006 | Role from Tenant A reused in Tenant B | 403 |
| NEG-007 | Role assignment exists without valid membership | DB reject / 403 |
| NEG-008 | Legacy enterprise role is sole authority | 403 |
| NEG-009 | Buyer tenant equals Seller tenant | DB reject |
| NEG-010 | Non-participant tenant reads transaction | 403/404 without data leak |
| NEG-011 | Third party accesses transaction without participant relationship | 403 |
| NEG-012 | Transaction assignment tenant differs from participant | DB reject |
| NEG-013 | Assignment user lacks active membership in participant tenant | DB reject / 403 |
| NEG-014 | Duplicate Buyer or Seller participant | DB reject |
| NEG-015 | Site owner tenant mismatches transaction-site link | DB reject |
| NEG-016 | External site used without owner approval | 403 |
| NEG-017 | Pending, expired, or revoked site approval | 403 |
| NEG-018 | Site assignment without active membership | DB reject / 403 |
| NEG-019 | Site assignment points to another tenant's site | DB reject |
| NEG-020 | Source site authorized but destination site unauthorized | 403; no movement |
| NEG-021 | Inquiry ownership inferred from email/creator/tracking code | Must not assign |
| NEG-022 | Legacy inquiry has ambiguous ownership | Quarantine; deny business access |
| NEG-023 | Transaction linked to inconsistent inquiry owner/participants | Reject |
| NEG-024 | Duplicate transaction route handlers remain | CI/static contract failure |
| NEG-025 | Mandatory authorization audit persistence fails | 503; mutation rollback |
| NEG-026 | Membership/assignment revoked during sensitive operation | Recheck/serialize; deny stale authority |
| NEG-027 | Client forges tenant, role, participant, owner, or site ID | Ignore as authority; deny mismatch |
| NEG-028 | Goods release lacks required release-policy conditions | Deny; no release side effect |
| NEG-029 | User reads another tenant's internal document through a transaction reference | Deny unless explicitly shared |
| NEG-030 | User uses stale cached permissions after role revocation | Deny |

## 12. Positive authorization coverage

The security suite must also prove legitimate access:

- POS-001: Buyer member reads only transactions where its tenant is Buyer participant.
- POS-002: Seller member reads only transactions where its tenant is Seller participant.
- POS-003: Approved third-party tenant accesses only explicitly assigned transaction scope.
- POS-004: User with two active memberships switches tenant after fresh validation.
- POS-005: Site owner approves an external transaction-site link; use succeeds only within approved purpose and effective period.
- POS-006: A site used by multiple transactions has a separate valid link/approval per transaction.
- POS-007: Revoking site approval blocks subsequent operations.
- POS-008: Assignment is constrained to active membership, participant, transaction, role, and site.
- POS-009: Inquiry remains with originating tenant until authorized transfer.
- POS-010: Ambiguous legacy inquiry remains quarantined.
- POS-011: Mandatory audit record commits atomically with sensitive mutation.
- POS-012: Contract-defined goods-release conditions are enforced independently of generic role access.

## 13. Audit and accountability

Sensitive decisions and mutations must record, as applicable:
- Actor user and session.
- Active tenant and membership.
- Role/permission evaluated.
- Action and resource identifier.
- Transaction and participant references.
- Site/warehouse reference.
- Authorization outcome and reason code.
- Timestamp and correlation/request identifier.
- Approval/delegation evidence where applicable.

Audit records must be protected from ordinary user modification. If audit persistence is mandatory for an operation and unavailable, the operation fails closed and rolls back.

## 14. Legacy data and migration-readiness policy

Migration from single-enterprise to multi-tenant authorization must be planned separately and include:

1. Inventory all uses of `SINGLE_ENTERPRISE_ID` and `requireActiveEnterprise()`.
2. Inventory every route and middleware chain.
3. Map users to internal identities and evidenced tenant memberships.
4. Map tenant roles to membership-bound role assignments.
5. Map transactions to explicit Buyer/Seller/third-party participants.
6. Map sites, warehouses, transaction-site links, and user assignments.
7. Identify records with missing or ambiguous ownership.
8. Quarantine unresolved records with reason and auditable remediation path.
9. Define additive/idempotent migration and rollback/recovery strategy.
10. Verify SQLite foreign-key enforcement and parity with the target PostgreSQL constraints.
11. Run positive, negative, concurrency, revocation, and regression tests.
12. Enable new authorization paths only after the schema and data disposition gates pass.

Never infer ownership from email, email domain, organization label, creator, tracking code, or a default tenant. Backfill requires evidence and an authorized human decision.

## 15. Open policy decisions before implementation

This architecture baseline does not silently decide the following details. They must be resolved in the detailed authorization policy/API/schema specification before implementation:

1. Whether a single membership may hold multiple simultaneous roles.
2. Who may invite, approve, suspend, and revoke tenant membership.
3. Whether tenant switching uses a new session, context token, or request-scoped context.
4. Authorization context lifetime and revocation propagation SLA.
5. Authorized Representative delegation model, scope, expiry, and revocation.
6. Emergency access rules for auditors and platform administrators.
7. Behavior when a site assignment is revoked during an in-flight handover.
8. Whether suppliers are independent tenants in the initial release or a constrained participant category.
9. Exact document visibility rules across Buyer/Seller participants.
10. Exact Syariah reviewer permissions and evidence requirements.

Each decision must have an owner, rationale, and impact assessment. These open details do not weaken the approved baseline principles: tenant isolation, explicit relationships, least privilege, server-side enforcement, and fail-closed behavior.

## 16. Acceptance and release gates

This architecture baseline is accepted as the input to the next design stage. Implementation remains blocked until detailed policy and schema decisions are closed.

### Architecture acceptance
- [x] Buyer and Seller are separate tenant contexts.
- [x] Identity is separated from tenant membership.
- [x] Tenant context is membership-validated server-side.
- [x] Roles are tenant/membership scoped; role alone is insufficient.
- [x] Transaction participant access is explicit.
- [x] Site ownership, transaction-site approval, and user assignment are distinct checks.
- [x] Route authorization pipeline is defined.
- [x] Negative and positive test contracts are defined.
- [x] Legacy ownership ambiguity is quarantined.
- [x] Contract, payment, evidence, release, and Syariah governance principles are preserved.

### Implementation readiness (not yet accepted)
- [ ] Open policy decisions resolved.
- [ ] API contract and schema parity approved.
- [ ] Composite integrity design approved.
- [ ] Migration and legacy-data disposition plan approved.
- [ ] Route inventory reconciled and duplicate handlers resolved.
- [ ] Automated positive/negative authorization suite implemented and passing.
- [ ] Concurrency, revocation, and audit-failure tests passing.
- [ ] GitHub Actions evidence green for exact candidate SHA.
- [ ] Separate explicit implementation authorization granted.

## 17. Downstream document dependency

| Document | Dependency | Status |
|---|---|---|
| UI-INVENTORY-P0-001 | Three-platform source inventory | Baseline |
| AUTH-MOBILE-RECONCILIATION-001 | This specification | Approved architecture |
| UI-NAVIGATION-ROLE-MATRIX-001 | This authorization baseline | Next design artifact |
| UI-SCREEN-SPECIFICATION-001 | Navigation/role matrix review | Blocked |
| UI-CROSS-PLATFORM-PARITY-001 | Screen specifications | Blocked |

**Next permitted design activity:** prepare the Web–Mobile–Desktop navigation/role matrix using this approved authorization baseline. UI implementation remains out of scope.

---
End of AUTH-MOBILE-RECONCILIATION-001.
