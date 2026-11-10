# DOMAIN RECONCILIATION — SUPPLIER HYBRID vs ADR P0-001

**Document ID:** DOMAIN-RECONCILIATION-SUPPLIER-HYBRID-ADR-P0-001  
**Status:** RECONCILED AGAINST APPROVED DOMAIN BASELINE  
**Date:** 2026-11-10  
**Scope:** Buyer/Seller/Supplier identity, legal-party identity, transaction participation, tenant authorization scope, and site assignment  
**Execution mode:** Read-only domain reconciliation; no implementation or migration authorization

## 1. Executive decision

The approved multi-tenant domain baseline governs. The single-operating-enterprise recommendation in Mobile ADR P0-001 is **not adopted** for this product baseline where it conflicts with the approved Buyer/Seller separate-tenant model and the approved Supplier hybrid model.

The conflict is resolved by keeping three concepts distinct and explicitly related:

1. **Legal party** — the legal person or organization named in the commercial contract.
2. **Tenant** — an independently governed identity, membership, administration, and data-isolation boundary.
3. **Transaction participant / authorization scope** — the explicit, current relationship that permits a tenant to access a particular transaction and only the resources/actions within its granted scope.

Buyer, Seller, and Supplier are each represented by independent tenant identities. Supplier's hybrid nature means it retains its own tenant boundary while receiving operational access to a Buyer/Seller transaction and site only through explicit participant and assignment relationships. It does not mean Supplier is a role inside the Buyer or Seller tenant.

This reconciliation preserves valid separation principles from ADR P0-001, but replaces its single-operating-enterprise assumption and its proposed generic scope bridge with a participant-centered multi-tenant model.

## 2. Binding decisions and precedence

| Decision/source | Existing decision | Reconciliation disposition |
|---|---|---|
| Approved product domain baseline | Buyer and Seller are separate tenants | RETAIN — binding |
| Previously approved Supplier architecture | Supplier uses a hybrid model with independent tenant identity and explicit operational relationships | RETAIN — binding |
| OD-007 clarification in OPEN-ARCHITECTURE-DECISIONS-001 | Supplier has own tenant, memberships and administration; transaction participation and site access are explicit, active, scoped, time-bounded and auditable | RETAIN — binding |
| ADR P0-001 | Recommends one operating enterprise and external Buyer/Seller legal parties | NOT ADOPTED where it conflicts with the approved multi-tenant baseline |
| ADR P0-001 legal-party separation | Legal-party identity is distinct from tenant identity; contract party identity must be preserved | RETAIN as a domain principle |
| ADR P0-001 transaction_tenant_scopes | Generic scope bridge for a single operating tenant and delegated tenants | REPLACE with canonical transaction_participants relationship for party tenants; do not create a second competing source of transaction access truth |
| ADR P0-001 composite FK recommendations | Tenant+transaction and tenant+site integrity for assignments and site links | RETAIN as integrity requirements, with FK targets aligned to the participant-centered model |
| ADR P0-001 NULL site proposal | Enterprise-wide transaction scope for selected roles | NOT ADOPTED as a default. Any transaction-wide scope must be an explicit, separately authorized permission; operational Supplier roles require site scope |

**Precedence:** approved domain decisions and approved OD clarifications outrank an unapproved/recommended ADR. This reconciliation does not silently amend or revoke the approved Buyer/Seller/Supplier domain decisions.

## 3. Canonical domain model

### 3.1 Legal party and tenant identity

- `legal_parties` represents contractual legal identity, not login or authorization.
- `tenants` represents independently isolated platform organizations and their administration boundary.
- `tenant_legal_party_bindings` explicitly associates a tenant with a verified legal party where the relationship is needed for contracting.
- The binding must record verification evidence, status, effective period, verifier, and audit reference.
- A legal party name, email domain, registration number supplied by a client, or transaction label must never implicitly establish tenant membership or access.
- Do not assume a universal one-to-one mapping. A legal party may have multiple independently governed tenants only where the relationship is verified and explicitly recorded. A tenant must not silently represent multiple unrelated legal parties.
- Legacy records whose tenant-to-legal-party relationship cannot be proven remain quarantined for manual resolution.

### 3.2 Transaction identity and contractual parties

A commercial transaction records its contractual Buyer and Seller legal-party identities independently of the tenants that access it.

Conceptual fields:

```text
commercial_transactions
  id
  buyer_party_id  -> legal_parties.id
  seller_party_id -> legal_parties.id
  lifecycle_status
  created_at
```

- Buyer and Seller contract identities are not inferred from the creator, current tenant header, or Supplier assignment.
- Contract signing binds an immutable contract snapshot to the approved legal-party identities and applicable transaction participants.
- A post-approval change to Buyer/Seller identity requires the contract amendment, consent, versioning, legal review, and audit process; it is not a routine tenant switch.
- No singular `operating_tenant_id` is the authority for the entire multi-party transaction.

### 3.3 Canonical transaction participant relationship

Use one canonical participant relationship to establish which tenant participates in a transaction and its party role.

Conceptual model:

```text
transaction_participants
  id
  transaction_id
  tenant_id
  legal_party_id
  participant_role       -- buyer | seller | supplier
  participation_status   -- invited | pending | active | suspended | revoked
  effective_from
  effective_until
  approved_by
  approval_reference
  created_at
  updated_at

  UNIQUE (tenant_id, transaction_id)
  UNIQUE (id, tenant_id, transaction_id)
```

The final physical key strategy may use a stable participant ID plus explicit composite UNIQUE keys. The conceptual invariants are binding:

- Buyer tenant participates as Buyer only when its verified tenant/legal-party binding matches the transaction's Buyer legal party.
- Seller tenant participates as Seller only when its verified binding matches the transaction's Seller legal party.
- Supplier tenant participates as Supplier through an explicit relationship; it retains its own memberships, tenant administrators, users, and tenant data.
- A participant becomes authorization-eligible only when its relationship is active, within its effective period, and not suspended/revoked.
- Participant status is checked server-side for each protected operation.
- Participant relationship does not itself grant unrestricted access to all transaction data, all tenant resources, or all sites.
- Participant creation, approval, activation, suspension, expiry, and revocation are attributable and auditable.

For any future non-party service provider that is not a contractual/approved transaction participant, do not mislabel it as Buyer, Seller, or Supplier. Model a separately approved, bounded delegation/grant with its own authority, scope, lifecycle, and audit.

### 3.4 Participant scope and site assignment

Transaction participation establishes the tenant's relationship to the transaction. Site assignment narrows operational access further.

Conceptual model:

```text
transaction_site_links
  id
  tenant_id
  transaction_id
  site_id
  participant_id
  link_status
  created_at

transaction_access_assignments
  id
  tenant_id
  transaction_id
  participant_id
  site_id
  subject_user_id
  permitted_actions
  effective_from
  effective_until
  assignment_status
  granted_by
  revoked_by
  revocation_reason
  audit_reference
```

Invariants:

- Supplier operational users must have an active Supplier tenant membership, active Supplier transaction participant, and active assignment for the exact transaction, site, action, and validity period.
- A Supplier participant cannot enumerate unrelated Buyer/Seller tenant resources.
- A site assignment does not confer Buyer/Seller tenant membership, contract-signing authority, payment-ledger authority, or goods-release authority.
- Transaction-wide access, where needed for a non-operational role, must be a named and explicit permission/scope. It must not arise from NULL site values or broad role labels by default.
- Operational roles (Supplier, warehouse, QC, logistics) require a non-null, matching site assignment.
- Revocation/expiry blocks subsequent protected operations. Dependent handovers are suspended safely; custody is not silently transferred. A new assignment and explicit custody acceptance are required for reassignment.

## 4. Authorization source of truth

For each protected request, server-side authorization must validate, in order:

1. Authenticated principal and current session.
2. Active membership of the principal in the selected tenant.
3. Server-established active tenant context; client tenant ID is only a selection input.
4. Active transaction participant matching the tenant, transaction, legal-party relationship, and participant role.
5. Active site assignment for the exact site, permitted action, and validity period where the action is operational/site-bound.
6. Resource ownership/classification and minimum necessary access.
7. Applicable contract, dispute, payment, evidence, custody, legal, and Syariah preconditions.
8. Current authorization/revocation state at request time, including offline command replay.
9. Attributable audit event and correlation reference.

All checks fail closed. UI visibility, a cached role, a local SQLite row, a client-supplied tenant/participant/site ID, or an offline timestamp is never authorization proof.

## 5. Composite-key consequences

The canonical participant relationship is the tenant-to-transaction authorization anchor. The exact FK targets must be finalized in the canonical schema review, but the following invariants are required:

1. `transaction_access_assignments(tenant_id, transaction_id)` must reference a unique tenant+transaction participant key.
2. `transaction_site_links(tenant_id, transaction_id)` must reference the same participant scope.
3. `transaction_access_assignments(tenant_id, site_id)` must reference `supply_sites(tenant_id, id)`.
4. `transaction_site_links(tenant_id, site_id)` must reference `supply_sites(tenant_id, id)`.
5. Where participant ID is stored, composite FK consistency must ensure `participant_id`, `tenant_id`, and `transaction_id` refer to the same participant row.
6. Supplier role and participant status must be validated by server-side policy; FK integrity alone cannot prove an assignment is authorized.
7. SQLite and PostgreSQL must enforce equivalent referential invariants; PostgreSQL RLS is additional defense-in-depth, not a replacement for composite FKs.

This resolves the conceptual ambiguity behind the previously proposed `transaction_tenant_scopes`: for Buyer, Seller, and Supplier party tenants, the active `transaction_participants` row is the canonical relationship and scope anchor. Do not maintain a second independently mutable scope table that can drift from participant status. If a future non-party delegated operator requires access, that is a distinct delegated-grant model, not a second party-participant identity.

## 6. Contract lifecycle and governance boundaries preserved

This reconciliation does not change other approved domain rules:

- Before contract signing, either party may unilaterally suspend or withdraw consent to a transaction scope.
- Scope activation and reactivation require bilateral approval by authorized Buyer and Seller representatives.
- Participant activation does not itself activate the contract or override bilateral scope approval.
- Contract snapshot remains the source of truth for contractual agreement.
- Payment ledger remains the source of truth for financial settlement.
- Evidence register remains the source of truth for fulfillment.
- Goods release remains server-authorized and condition-based.
- Seller Authorized Representative issues/confirms the release instruction.
- Buyer approval is required only where the signed contract snapshot or applicable law explicitly requires it.
- Supplier assignment cannot grant release authority.
- Syariah Reviewer remains review/comment/recommend only; it cannot approve transactions, mutate the ledger, or authorize release.
- Break-glass, delegation, audit, dispute, and financial controls remain bounded by their separately approved OD decisions.

## 7. Explicit disposition of ADR P0-001

| ADR P0-001 element | Final disposition |
|---|---|
| Single operating enterprise | REJECTED for this product baseline; conflicts with approved Buyer/Seller separate tenants and Supplier independent tenant |
| Buyer/Seller as legal parties distinct from tenant identity | RETAIN |
| `legal_parties` registry | RETAIN, subject to verified tenant/legal-party binding |
| Singular `operating_tenant_id` | REMOVE from canonical domain authority model |
| `transaction_tenant_scopes` as the only scope bridge | REPLACE for party tenants with `transaction_participants` |
| External party access assignments | RETAIN the separation principle; map external users through their own tenant membership and active transaction participant, not membership inside another party's tenant |
| Four tenant+transaction/site composite FKs | RETAIN as required integrity controls, targeting the canonical participant relationship and tenant-scoped sites |
| Enterprise-wide NULL site scope | NOT A DEFAULT; explicit scope and permission required |
| SQLite/PostgreSQL parity and RLS | RETAIN as mandatory backend/schema acceptance requirements |
| Legacy identity conversion | RETAIN quarantine/manual reconciliation; never infer tenant/legal-party identity |

The Mobile ADR remains a historical recommendation document with status **NOT APPROVED**. This cross-platform reconciliation records the controlling domain resolution; it does not retroactively claim the original ADR was approved.

## 8. Required evidence to close the domain-to-source reconciliation

| Evidence ID | Required proof | Platforms | Status |
|---|---|---|---|
| DOM-001 | Buyer, Seller, Supplier each have independent tenant identities and memberships | Web/Mobile/Desktop | NOT EVIDENCED |
| DOM-002 | Verified tenant-to-legal-party binding and immutable contract party snapshot | All | NOT EVIDENCED |
| DOM-003 | Active transaction participant is the canonical tenant-transaction relationship | All | NOT EVIDENCED |
| DOM-004 | Supplier access requires active participant plus exact site/action/time assignment | All | NOT EVIDENCED |
| DOM-005 | Revocation blocks access and suspends dependent handovers without silent custody transfer | All | NOT EVIDENCED |
| DOM-006 | Composite FK integrity prevents tenant/transaction/site tuple substitution | All | NOT EVIDENCED |
| DOM-007 | No duplicate independently mutable participant/scope source of truth | All | NOT EVIDENCED |
| DOM-008 | Cross-tenant unrelated-resource negative tests and allowed participant positive tests | All | NOT EXECUTED |
| DOM-009 | Contract party amendment and bilateral scope lifecycle enforce approved rules | All | NOT EVIDENCED |
| DOM-010 | Canonical schema parity and PostgreSQL RLS under least-privilege role | All | NOT VERIFIED |

## 9. Acceptance criteria for closing this reconciliation

- [ ] The approved Buyer/Seller separate-tenant and Supplier hybrid decisions are reflected consistently in the canonical domain model.
- [ ] The single-operating-enterprise assumption is removed from the target model for this product.
- [ ] Legal party identity, tenant identity, and transaction participant identity remain distinct and explicitly linked.
- [ ] Supplier remains an independent tenant and is not reduced to an internal role.
- [ ] Transaction participation and site assignment are separate, bounded authorization layers.
- [ ] The canonical participant relationship is the single party-tenant-to-transaction scope anchor.
- [ ] Composite tenant+transaction and tenant+site constraints are specified against that anchor.
- [ ] Revocation, expiry, custody handover, and audit semantics are specified.
- [ ] Domain owner, legal reviewer, database reviewer, and security reviewer have reviewed their respective responsibilities before physical schema approval.

## 10. Governance and authorization boundary

This document reconciles approved domain decisions with an unapproved architecture recommendation. It is not implementation approval.

It does **not** authorize:
- code or schema changes;
- DDL or migration/backfill;
- changes to a physical database, Supabase project, RLS, or environment;
- execution of tests against shared/live systems;
- PR creation, merge, or deployment;
- production or staging mutation.

Any such work requires separate explicit authorization. Existing source-level blockers remain open until exact-SHA technical evidence satisfies the acceptance criteria.
