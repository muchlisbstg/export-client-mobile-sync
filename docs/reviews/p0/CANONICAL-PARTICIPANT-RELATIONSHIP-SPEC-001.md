# CANONICAL-PARTICIPANT-RELATIONSHIP-SPEC-001

**Status:** LOGICAL CONTRACT FOR REVIEW — DEC-001–DEC-005 APPROVED  
**Date:** 2026-11-10  
**Scope:** Tenant/legal-party binding, transaction participants, sites and user assignments  
**Execution:** Read-only specification; no DDL or migration authorization

## 1. Purpose and terminology

This specification defines the canonical party-tenant-to-transaction relationship. It separates four concepts:

- Legal party: contractual legal identity.
- Tenant: independently governed identity and isolation boundary.
- Participant: tenant's approved relationship to one transaction.
- Assignment: user-specific, action- and resource-bounded authorization within a participant.

A participant is not a user role, tenant membership, contract signature, or unrestricted transaction permission.

## 2. Relationship cardinalities

| Relationship | Cardinality / invariant |
|---|---|
| Tenant → current verified legal-party binding | Zero or one at any instant; historical versions retained |
| Tenant → transaction participant | At most one row per transaction (`UNIQUE tenant_id, transaction_id`) |
| Transaction → Buyer participant | Exactly one when transaction enters approved commercial state; at most one during draft/invitation lifecycle |
| Transaction → Seller participant | Exactly one when transaction enters approved commercial state; at most one during draft/invitation lifecycle |
| Transaction → Supplier participants | Zero or more; each Supplier tenant has at most one participant row |
| Participant → user assignments | Zero or more |
| Participant → site links | Zero or more |
| Assignment → action grants | One or more for an active assignment; each action must exist and be active |
| Site → owner tenant | Exactly one |

The one-Buyer and one-Seller role cardinalities are logical transaction invariants. They require explicit physical enforcement (e.g. role-filtered unique indexes plus lifecycle validation); DEC-002 alone only approves uniqueness by tenant/transaction.

## 3. Canonical logical entities

### 3.1 tenant_legal_party_bindings

Required attributes:
- `id`, `tenant_id`, `legal_party_id`
- `verification_status`
- `effective_from`, `effective_until`
- `verified_by`, `evidence_reference`, `audit_reference`
- creation timestamp and version/history attribution

Invariant: no overlapping verified/effective binding periods for one tenant. A verified record requires evidence and verifier attribution. Rebinding creates a new version; history is retained.

### 3.2 commercial_transactions

Required attributes:
- `id`
- `buyer_party_id`, `seller_party_id`
- controlled transaction lifecycle state
- created/updated timestamps

Invariant: Buyer and Seller legal-party IDs are distinct. A legal-party change after contract approval follows amendment and legal approval; tenant switching cannot rewrite a signed contract snapshot.

### 3.3 transaction_participants

Required attributes:
- `id`, `tenant_id`, `transaction_id`, `legal_party_id`
- `participant_role`: `buyer | seller | supplier`
- `participation_status`
- `effective_from`, `effective_until`
- approval actor/reference and audit timestamps

Normative candidate keys:
```sql
PRIMARY KEY (id);
UNIQUE (tenant_id, transaction_id);
UNIQUE (id, tenant_id, transaction_id);
```

DEC-002: one participant per tenant/transaction. Different Supplier tenants may participate in the same transaction. A participant can have multiple user assignments and site links.

Role invariants:
- Buyer participant legal party must equal `commercial_transactions.buyer_party_id`.
- Seller participant legal party must equal `commercial_transactions.seller_party_id`.
- Buyer and Seller tenant identities must be distinct.
- Supplier uses an independent tenant and its verified legal-party binding; Supplier is not a role inside Buyer/Seller tenant.
- Supplier participation requires explicit approval and bounded operational scope.
- A pending, suspended, revoked or expired participant grants no operational access.

**Schema-review refinement (not yet approved):** add a reference to the exact tenant/legal-party binding version used for participant approval, e.g. `tenant_legal_party_binding_id`, with a composite FK to `(id, tenant_id, legal_party_id)`. This prevents an old participant from silently inheriting a later tenant rebinding. The field name and lifecycle semantics require reviewer approval before freeze.

### 3.4 transaction_site_links

Required attributes:
- `id`, `tenant_id`, `transaction_id`, `participant_id`, `site_id`
- purpose, link status, effective period, approval/audit attribution

Invariant: link must reference the same participant, tenant and transaction, and the site must be owned by the same tenant. Site link approval is distinct from user assignment.

### 3.5 transaction_access_assignments

Required attributes:
- `id`, `tenant_id`, `transaction_id`, `participant_id`, `site_id`
- `subject_user_id`
- status, effective period, grant/revoke actor, reason and audit reference

Invariant: operational roles require an exact non-null site. Assignment must match participant, tenant, transaction and an active site link. User must have active membership in the participant tenant.

### 3.6 permission_actions and transaction_access_assignment_actions

Action codes are canonical, normalized and lifecycle-controlled. Assignment-action rows reference both an assignment and an active action catalog entry. Free-form client action codes are prohibited.

## 4. Lifecycle contract

Participant lifecycle: `invited → pending → active → suspended/revoked/expired`, with reactivation only through the approved approval path. Exact transition graph and terminal-state policy require review.

- Buyer/Seller transaction-scope activation/reactivation requires bilateral approval by the relevant authorized representatives.
- Supplier additionally requires explicit Supplier participation approval and bounded operational scope.
- Unilateral protective suspension is permitted under the approved rule.
- Pending participants receive no operational access.
- Revocation/expiry blocks subsequent protected operations and preserves history.
- Reassignment creates a new assignment; it does not overwrite revoked history.
- Revocation is not a custody transfer; handover requires explicit custody acceptance and server confirmation.

## 5. Authorization predicate

For operational actions, allow only when all relevant predicates hold at request time:

```text
valid_session
AND active_tenant_membership
AND server_established_tenant_context
AND active_matching_transaction_participant
AND active_transaction_site_link
AND active_assignment_for_exact_user_and_site
AND active_assignment_action
AND effective_time_window
AND not_revoked_or_suspended
AND applicable_contract_payment_custody_legal_syariah_policy
```

Client-provided tenant, participant, site, role, action, status or offline timestamp is never proof. Missing or stale evidence fails closed. PostgreSQL is authoritative for shared state; SQLite is provisional local/offline state and cannot authorize final replay.

## 6. Composite integrity requirements

1. Assignment `(tenant_id, transaction_id)` → participant `(tenant_id, transaction_id)`.
2. Assignment `(tenant_id, site_id)` → supply site `(tenant_id, id)`.
3. Site link `(tenant_id, transaction_id)` → participant `(tenant_id, transaction_id)`.
4. Site link `(tenant_id, site_id)` → supply site `(tenant_id, id)`.
5. Every row storing `participant_id` also references `(participant_id, tenant_id, transaction_id)` → participant `(id, tenant_id, transaction_id)`.
6. Assignment's site must be linked to the same participant and transaction; a site-owner FK alone is insufficient.
7. Assignment user must be a member of the same tenant; define a composite membership candidate key before physical implementation.

These constraints prove tuple consistency, not lifecycle, approval authority or current authorization.

## 7. Explicit authority exclusions

Supplier participation/assignment never grants:
- contract signing or amendment authority;
- payment approval, settlement or ledger authority;
- goods-release authority;
- authority to access unrelated tenant resources or unassigned sites.

## 8. Unresolved items before schema freeze

- Exact role cardinality enforcement for Buyer/Seller.
- Binding-version reference on participant rows.
- Non-party service-provider delegation model.
- Tenant-membership composite FK and user identity model.
- Exact approval evidence and actor-authority schema.
- Status transition graph and time-boundary semantics.
- Transaction-wide exception representation (must not use NULL site).
- Legal jurisdiction, identifiers, retention and verification evidence.
- PostgreSQL RLS, SQLite runtime provenance and cross-engine parity.

## 9. Governance

Logical contract only. No source-code change, DDL, migration, database execution, PR, merge, deployment or shared/live test is authorized.
