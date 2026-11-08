# P0-001 Database Design Closure Proposal

- **Status:** PROPOSED FOR DOMAIN, LEGAL, DATABASE, AND SECURITY REVIEW — NOT APPROVED
- **Record date:** 2026-11-08
- **Repository baseline:** `41fcddab3c1cb3cbc80f5ad518c7e23b074f6956`
- **Related ADR:** `docs/adr/ADR-P0-001-transaction-party-composite-integrity.md`
- **Scope:** Logical data model, tenant transaction scope, four composite foreign keys, nullable-site policy, and migration atomicity requirements.
- **Change class:** Documentation only. No source code, schema, DDL, migration, database, test, configuration, or runtime behavior is changed by this proposal.

> This document consolidates a target design for review. It does not itself constitute a business/legal decision, a Sharia approval, an independent reviewer sign-off, or authorization to implement or apply a migration. All implementation and database blockers remain OPEN.

## 1. Executive design position

Keep three concepts separate and enforce them independently:

1. **Contractual legal party** — the legal person or organization named as Buyer or Seller in the transaction-specific contract.
2. **Operating tenant** — the enterprise boundary that owns operational access, internal roles, and tenant-isolated records.
3. **Transaction tenant scope** — the explicit server-managed authorization grant that allows a tenant to access a transaction.

For the current single-enterprise product direction, the target is one configured operating tenant and separately registered Buyer/Seller legal parties. A legal party is not automatically a tenant, tenant member, or authenticated user.

The recommended model is intentionally conservative:
- only the configured operating tenant receives an `operating` transaction scope in the initial release;
- delegated tenant scope is reserved in the logical model but disabled until a separate business, legal, and security decision explicitly enables it;
- external counterparty login is not implied by the existence of `legal_parties`;
- the signed contract snapshot remains the contractual source of truth and must preserve the party identity and terms applicable at signing.

## 2. Target logical model

### 2.1 Contractual parties

```text
legal_parties
  id                       PK
  legal_name               NOT NULL
  country_code             NOT NULL
  registration_reference   nullable, jurisdiction-dependent
  status                   controlled lifecycle
  created_at               NOT NULL
  updated_at               NOT NULL

commercial_transactions
  id                       PK
  buyer_party_id           NOT NULL -> legal_parties.id
  seller_party_id          NOT NULL -> legal_parties.id
  operating_tenant_id      NOT NULL -> tenants.id
  status                   controlled lifecycle
  created_at               NOT NULL
  updated_at               NOT NULL
```

Design rules:
- Buyer and Seller references point to legal parties, not tenant IDs.
- The same legal party may participate in multiple transactions.
- Buyer and Seller must be distinct unless an exceptional legal structure is explicitly reviewed and approved.
- Legal name, jurisdiction, registration evidence, and relevant identifiers must be validated under applicable law; do not assume one universal registration-number format.
- Preserve immutable transaction/contract party snapshots at signing. A mutable registry record must not rewrite a signed contract's historical identity.
- Changing Buyer or Seller after signing is not an ordinary row update. It requires the applicable contract amendment, authority, consent, audit, and versioning process.
- Do not backfill legacy `buyer_tenant_id` or `seller_tenant_id` into `legal_parties` automatically. A tenant identifier is not proof of legal-party identity.

### 2.2 Operating tenant

`commercial_transactions.operating_tenant_id` identifies the enterprise responsible for operating the transaction in the single-enterprise deployment.

Rules:
- It must reference an existing tenant configured as the operating enterprise.
- It must not be derived from a client-supplied tenant header or Buyer/Seller name.
- Server configuration and server-side authorization determine the active operating tenant.
- The operating tenant is distinct from the Buyer and Seller legal parties.
- In the initial single-enterprise release, there is one configured operating enterprise. A future multi-operating-tenant capability requires a separate architecture and governance decision.

### 2.3 Transaction tenant scope bridge

```text
transaction_tenant_scopes
  tenant_id       NOT NULL -> tenants.id
  transaction_id  NOT NULL -> commercial_transactions.id
  scope_kind      NOT NULL: operating | delegated
  created_at      NOT NULL
  created_by      NOT NULL (server-authenticated actor/system identity)
  PRIMARY KEY (tenant_id, transaction_id)
```

The bridge is an authorization boundary, not a party registry.

Lifecycle and authority:
- The server creates the `operating` scope as part of the transaction-creation unit of work for the configured operating tenant.
- The client cannot create, widen, reactivate, or choose a tenant scope by submitting an arbitrary tenant ID.
- In the initial release, only `scope_kind = operating` is enabled. `delegated` is reserved and must be rejected until a separate policy, legal basis, consent model, and independent security review are approved.
- A scope is not proof that a transaction is contractually activated or that goods may be released.
- Contractual transaction-scope lifecycle follows the approved P0-001 domain policy: before signing, either party may unilaterally suspend or withdraw consent to a transaction scope; activation and reactivation require bilateral approval. After signing, apply the strict post-signing policy and the signed contract snapshot; any material change must follow the required amendment and approval process.
- Keep the contractual scope decision/version register distinct from this tenant-access bridge. The bridge must reflect only an authorized server-side access scope and must not replace the contractual decision record.
- Suspension, withdrawal, activation, and reactivation must be actor-attributed, reasoned, timestamped, versioned, and auditable. A protective suspension must not silently grant the other party an activation right.
- Scope removal or suspension must revoke effective access immediately or fail closed while the authoritative state is unavailable.

### 2.4 External party access

The existence of `legal_parties` does not authorize external Buyer/Seller accounts.

If external counterparties later need login, introduce a separately reviewed party-access model (for example, `transaction_party_access_assignments`) with verified user-to-legal-party membership, party-role consistency, revocation, audit, and non-disclosing cross-party reads. Do not insert external users into the operating tenant's `tenant_memberships` merely to satisfy existing authorization joins.

Until that design is approved and implemented, Buyer/Seller application roles are treated only as the internal enterprise roles defined by the current product authorization policy.

## 3. Four required composite foreign keys

The bridge and site key must enforce both transaction-scope integrity and site ownership integrity.

| # | Child columns | Referenced columns | Required guarantee |
|---|---|---|---|
| 1 | `transaction_access_assignments(tenant_id, transaction_id)` | `transaction_tenant_scopes(tenant_id, transaction_id)` | Assignment tenant is explicitly scoped to the transaction |
| 2 | `transaction_site_links(tenant_id, transaction_id)` | `transaction_tenant_scopes(tenant_id, transaction_id)` | Site-link tenant is explicitly scoped to the transaction |
| 3 | `transaction_access_assignments(tenant_id, site_id)` | `supply_sites(tenant_id, id)` | Assigned site belongs to the same tenant |
| 4 | `transaction_site_links(tenant_id, site_id)` | `supply_sites(tenant_id, id)` | Linked site belongs to the same tenant |

Constraint requirements:
- The referenced pairs must be declared as PRIMARY KEY or UNIQUE keys in the target database.
- Use restrictive delete/update behavior for scope, transaction, and site references; do not cascade-delete authorization or audit history.
- Keep `transaction_site_links.site_id NOT NULL`.
- Ensure all FK constraints are enabled and validated, not merely declared but unvalidated.
- Apply equivalent logical guarantees in SQLite and PostgreSQL. PostgreSQL is the authoritative target for production-grade FK/RLS verification.
- These four constraints do not replace server-side authorization or PostgreSQL RLS.

## 4. Nullable-site policy

### 4.1 Required policy

- `transaction_site_links.site_id`: always NOT NULL.
- `transaction_access_assignments.site_id`: nullable only for explicitly transaction-wide roles.
- Proposed transaction-wide allowlist: `enterprise_admin`, `buyer`, `seller`, and `auditor`.
- Proposed site-bound roles: `supplier`, `warehouse`, `qc`, and `logistics`; these roles require a non-NULL site.
- The allowlist is a proposed domain/security rule and must be confirmed by the domain owner and independent Security reviewer before implementation.

### 4.2 Enforcement

A composite FK with a nullable `site_id` does not validate a site reference when the child key is NULL. Therefore:
- enforce the role/nullability matrix using a database CHECK where expressible, or an equivalent database trigger where cross-table or engine-specific logic is required;
- for a non-NULL site, enforce the tenant/site composite FK;
- for every site-bound assignment, require an active matching `transaction_site_links` row for the same tenant, transaction, and site;
- enforce the active-link rule in the service layer and database trigger/constraint strategy, with race-safe transaction semantics;
- reject role changes that would turn a NULL-site assignment into a site-bound role unless a valid site/link is supplied in the same atomic operation;
- reject removal/deactivation of a site link while an active site-bound assignment depends on it, unless the same atomic operation revokes or reassigns the affected assignments;
- test NULL, non-NULL, role mismatch, inactive site, missing link, cross-tenant site, and concurrent revoke/link changes in both supported database engines.

No role should receive enterprise-wide access merely because a nullable column permits NULL.

## 5. Referential and lifecycle integrity

- `legal_parties` rows referenced by a transaction must not be hard-deleted. Use a reviewed inactive/archived state and retain contract snapshots.
- `operating_tenant_id` and the operating scope bridge row must agree. Enforce this invariant with a database constraint/trigger strategy and service validation.
- The bridge must not contain duplicate tenant/transaction pairs.
- A `delegated` scope must be rejected by default until enabled by an explicit policy decision; it cannot be inferred from Buyer/Seller identity.
- Assignments and site links must reference a valid scope bridge row.
- Scope suspension/revocation must invalidate effective access without deleting immutable audit history.
- Audit events must identify actor, action, decision, reason, affected transaction/scope version, request/idempotency reference, and timestamp.
- Use non-disclosing authorization responses for cross-tenant or non-disclosable resources according to the API authorization policy.

## 6. Migration atomicity and recovery requirements

### 6.1 Source-level observation

At the reviewed source baseline, `migrateTenantIsolation(db)` commits its own transaction before invoking `migrateSupplyChain(db)`; the supply-chain routine then executes a separate transaction. A failure in the second stage can therefore leave the first stage committed. This is a source-level observation, not a live database inspection.

### 6.2 Required target behavior

A future migration must be atomic at the intended migration boundary:
- one migration version or explicitly coordinated migration unit must include all dependent tenant, transaction-scope, site, assignment, and link schema changes;
- all DDL supported transactionally by the target engine, data backfill, validation, constraint enforcement, and migration-history update must commit together;
- failure at any pre-commit stage must roll back the entire unit; no partial tenant-only state may be marked complete;
- do not assume nested transaction wrappers provide one atomic boundary. Define transaction ownership explicitly and verify the actual database driver's savepoint/transaction behavior;
- SQLite migration orchestration must use one outer transaction around all dependent migration functions, with inner helpers designed to participate safely in that transaction; run FK validation before commit;
- PostgreSQL migration must use a single explicit transaction where supported. Any operation that cannot run inside a transaction must be isolated as a separately documented phase with a safe expand/contract strategy and a recoverable intermediate state;
- migration execution must be serialized/locked so concurrent application instances cannot interleave the same migration;
- migration version/checksum recording must occur in the same transaction as the schema change where supported;
- rollback/recovery must be rehearsed on a representative isolated copy and must not destroy signed contract snapshots, payment ledger records, evidence, or audit history.

### 6.3 Mandatory failure and recovery tests

At minimum:
1. Inject failure after tenant objects are created but before transaction-scope objects are complete.
2. Inject failure after scope bridge creation but before all four composite FKs are validated.
3. Inject failure during backfill and during migration-history update.
4. Confirm the database returns to the pre-migration schema/data state for transactional failure.
5. Confirm a retry is deterministic and idempotent.
6. Verify orphan/mismatch reports and manual-resolution workflow; never guess legacy legal-party ownership.
7. Verify backup/restore and forward-recovery where rollback is not technically safe.
8. Verify foreign-key checks, PostgreSQL RLS, and least-privilege application-role behavior after migration on an isolated candidate database.

No staging or production database may be inspected or changed as part of this documentation PR. No migration file is proposed here.

## 7. Required test and review matrix

| Domain | Positive evidence required | Negative/failure evidence required |
|---|---|---|
| Legal party | Buyer/Seller reference valid legal-party records and immutable signed snapshot | Missing, duplicate, invalid, or unauthorized party substitution |
| Operating tenant | Transaction and operating scope agree for configured tenant | Client-supplied tenant override; mismatched operating tenant/scope |
| Transaction scope | Server creates operating scope; approved activation lifecycle is honored | Unscoped tenant; unauthorized delegated scope; revoked/suspended scope access |
| Composite FKs | All four valid tuple relationships accepted | Tenant/transaction mismatch; foreign-tenant site; orphan reference |
| Nullable site | Approved transaction-wide role may use NULL; site-bound role has valid site/link | Operational role with NULL; unauthorized role with NULL; inactive/missing link |
| Atomicity | Complete migration commits as one unit | Injected stage failure leaves no partial committed migration |
| PostgreSQL RLS | Least-privilege app role sees only authorized rows | Owner/superuser bypass is not accepted as evidence; cross-tenant reads/writes denied |
| Concurrency | Concurrent scope/assignment/link changes preserve invariants | Race between revoke, deactivate, link removal, and mutation fails closed |

Required reviewers:
- Business/domain owner: product model, party identity, scope lifecycle, role/site policy.
- Qualified Legal reviewer(s): jurisdictional legal-party identity, records/retention, contractual party changes, and relevant transaction rules.
- Independent Database reviewer: ERD, FK design, atomicity, migration, rollback/recovery, PostgreSQL behavior.
- Independent Security reviewer: tenant isolation, party access, NULL-site policy, revocation, RLS, and non-disclosure.

Reviewer identity, qualifications, independence, conflicts, evidence, findings, and disposition must be recorded. No reviewer is appointed or contracted by this document.

## 8. Open decisions that block approval

| ID | Decision required | Proposed disposition | Authority |
|---|---|---|---|
| D-01 | Confirm single operating enterprise plus external legal parties | Adopt as target model | Business/domain owner |
| D-02 | Confirm Buyer/Seller roles are internal staff in initial release | No external party login until separately reviewed | Business/domain + Security |
| D-03 | Confirm delegated tenant scope | Disabled in initial release | Business/domain + Legal + Security |
| D-04 | Confirm post-signing transaction-scope amendment lifecycle | Apply strict signed-contract and bilateral approval policy | Business/domain + Legal + both parties as applicable |
| D-05 | Confirm transaction-wide NULL-site allowlist | enterprise_admin, buyer, seller, auditor (proposed) | Business/domain + Security |
| D-06 | Confirm legal-party identifiers, jurisdiction, retention, and immutable snapshot fields | Jurisdiction-specific legal review required | Qualified Legal |
| D-07 | Confirm database-specific trigger/constraint implementation and migration atomicity | Independent technical review required | Database + Security |

These are review questions, not approvals. Any change to the proposed model must be recorded with rationale, decision authority, date, and impact on the API authorization matrix and contract/evidence/payment sources of truth.

## 9. Acceptance gates

This design proposal can be promoted to an approved domain/architecture decision only after:
- [ ] D-01 through D-07 have explicit written dispositions from the relevant authorities.
- [ ] The logical ERD and relationship/constraint matrix are reviewed.
- [ ] The role-to-nullability/site-scope matrix is approved.
- [ ] Independent Database and Security reviewers are selected, qualified, conflict-checked, and have issued written dispositions.
- [ ] PostgreSQL FK/RLS and least-privilege test plans are accepted.
- [ ] Atomicity, rollback, recovery, and data-preservation strategy are accepted.
- [ ] All findings are closed or explicitly accepted by the authorized risk owner.

A later implementation request requires a separate PR and separate explicit approval. A later DDL/migration execution requires a separate explicit authorization for the target environment. Approval of this document, if later granted, does not automatically authorize code, DDL, migration, merge, deployment, or production release.

## 10. Explicit non-authorization

This proposal authorizes only its own documentation change through a Draft PR. It does not authorize:
- source-code or runtime changes;
- schema changes, DDL, SQL, or Supabase migrations;
- staging or production database access or mutation;
- data backfill or conversion of legacy tenant identifiers;
- RLS changes or privilege changes;
- RFQ, reviewer engagement, spending, or contracts;
- merge, deployment, payment activation, contract signing, goods release, or production release.

**Disposition: PROPOSED — NOT APPROVED. Keep all five schema blockers OPEN.**
