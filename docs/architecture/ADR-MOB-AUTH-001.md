# ADR-MOB-AUTH-001 — Tenant-Scoped Multi-Tenant Authorization

- **Status:** Proposed — P0 architecture reconciliation; not implementation approval
- **Version:** 1.0
- **Scope:** Mobile API authorization and transaction/site access
- **Baseline:** `main` at `0a3c595c6697f56d0cef8536c3b93c3886cc5ab1` (revalidate before implementation)
- **Evidence reviewed:** `server/authorization.mjs`, `server/index.mjs`, `server/supply-chain-routes.mjs`, `scripts/migrate-tenant-isolation.mjs`, `test/supply-chain.test.mjs`

## 1. Context

The approved product domain is Buyer and Seller as separate tenant contexts (Opsi B). The current Mobile authorization module is still single-enterprise: it receives `singleEnterpriseId`, resolves membership only within that tenant, rejects another `x-active-tenant-id` with `enterprise_context_locked`, and requires legacy `enterprise_role_assignments`. This is incompatible with the approved multi-tenant model.

The current route layer also contains transaction routes in both `server/supply-chain-routes.mjs` and `server/index.mjs`. The supply-chain router is registered before the later index-level transaction handlers. This duplicate registration must be removed or deliberately consolidated during implementation; route order must not be used as an authorization control.

## 2. Decision

### 2.1 Tenant context and membership

1. Authorization is request-scoped and tenant-scoped. There is no global `singleEnterpriseId` authorization authority.
2. The requested active tenant is resolved from an authenticated request and validated against an active `tenants` row.
3. `tenant_memberships(tenant_id,user_id)` is the authoritative membership relationship. Membership must be active for the request tenant.
4. A user may belong to multiple tenants. Switching tenant context requires a fresh membership check; it must never carry authorization from the previous tenant.
5. Tenant role grants must be bound to the membership using a composite relationship equivalent to `(tenant_id,user_id)`. Legacy `enterprise_role_assignments` cannot independently grant access.
6. Suspended, revoked, missing, or ambiguous membership/role data fails closed.

### 2.2 Transaction participants

1. A commercial transaction explicitly identifies its Buyer and Seller tenants; they must be distinct.
2. A normalized `transaction_parties` relationship records each participating tenant and party role. Exactly one Buyer and one Seller are required per transaction.
3. Operational third parties (Supplier, Warehouse Operator, QC Provider, Logistics Provider, Auditor, and other explicitly approved parties) may participate only through an explicit transaction-party relationship.
4. An assignment must reference a valid transaction participant and an active user membership in that participant tenant. Role text or a user-supplied tenant ID alone is insufficient.
5. A transaction participant relationship does not itself grant every operation. Role, assignment, resource scope, and operation policy are evaluated independently.

### 2.3 Site ownership and transaction use

1. Each site has exactly one owning tenant. Site ownership is not inferred from a transaction, user, email, or historical creator.
2. A site may be used by more than one transaction only through an explicit `transaction_sites` relationship.
3. A transaction-site link must identify the transaction participant/owner context, site, purpose, approval state, approving authority, and effective period as required by the domain.
4. A non-owner participant cannot use or assign an external tenant's site without an explicit approval from the site-owning tenant's authorized representative.
5. User site assignments must be constrained to an active membership and an approved transaction-site scope where the operation is transaction-bound.
6. Site ownership, transaction approval, user assignment, and site active status are separate checks.

### 2.4 Inquiry ownership

1. Every inquiry has one explicit `owner_tenant_id`; that tenant retains ownership unless an authorized, auditable transfer is completed.
2. Buyer/Seller participation fields describe transaction participants and do not substitute for inquiry ownership.
3. Legacy inquiries without reliable ownership evidence remain quarantined/unassigned. Never infer ownership from email domain, organization name, tracking code, creator, or current tenant.
4. A transaction may reference an inquiry only after ownership and participant consistency are validated.

### 2.5 Authorization pipeline

The target middleware/service pipeline is:

1. Authenticate identity.
2. Resolve requested tenant context.
3. Verify tenant is active.
4. Verify active membership for identity + tenant.
5. Load membership-bound tenant roles.
6. Enforce operation role.
7. Resolve resource and verify tenant ownership.
8. Verify transaction participant relationship when transaction-bound.
9. Verify transaction-site relationship and owner approval when site-bound.
10. Verify user/role assignment and operation-specific scope.
11. Execute mutation in a transaction with required audit evidence.
12. Fail closed if authorization or mandatory audit persistence is unavailable.

All checks must be server-side. Client-supplied tenant, participant, site, or role fields are selectors at most, never proof of authority.

## 3. Consequences

- Remove the global single-enterprise lock and legacy role table as authorization authorities.
- Reconcile route registration so each route has one authoritative handler and one explicit middleware chain.
- Add normalized participant/site relationships and composite constraints before enabling third-party transaction access.
- Reconcile SQLite and PostgreSQL constraints and ensure foreign-key enforcement on every SQLite connection.
- Keep signed contract snapshot as contractual agreement source of truth, payment ledger as settlement source of truth, evidence register as fulfillment source of truth, and server-side authorization as the sole goods-release authority.
- No role, including Seller, Buyer, Warehouse, or Admin, automatically authorizes goods release. Existing contract-based release conditions remain authoritative.

## 4. Migration and legacy-data policy

- Migration is additive, idempotent, and reversible where technically feasible.
- Do not auto-populate inquiry owner, transaction participants, site approvals, or assignments from ambiguous legacy data.
- Unresolved records are quarantined with a reason and an auditable remediation path.
- Backfill requires documented evidence and an authorized human decision.
- Do not enable new multi-tenant routes until schema constraints, backfill disposition, and authorization tests pass.

## 5. P0 acceptance criteria

- [ ] No `singleEnterpriseId`, `requireActiveEnterprise`, or equivalent global tenant lock remains in the authorization path.
- [ ] Active tenant membership is the authoritative access prerequisite.
- [ ] Roles are membership-bound and tenant-scoped.
- [ ] Buyer/Seller uniqueness and third-party transaction participation are enforced.
- [ ] Assignment references a valid participant, active membership, and approved site scope.
- [ ] Site ownership and external-use approval are enforced server-side and by database constraints where possible.
- [ ] Inquiry ownership is explicit; legacy ambiguity remains quarantined.
- [ ] Duplicate transaction route registration is resolved.
- [ ] Negative and positive authorization tests pass.
- [ ] Audit failure, race conditions, tenant switching, and cross-tenant isolation are tested.
- [ ] CI evidence is recorded against the exact candidate commit.

## 6. Governance

This ADR is a proposed architecture/domain contract only. It does **not** authorize DDL, migrations, runtime code changes, merge, deployment, or production data changes. Implementation requires separate explicit approval after review of this ADR and the route matrix.
