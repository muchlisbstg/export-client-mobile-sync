# CANONICAL-PARTICIPANT-RELATIONSHIP-SPEC-001

**Status:** LOGICAL CONTRACT FOR REVIEW — DEC-001–DEC-005 APPROVED  
**Date:** 2026-11-10  
**Scope:** Tenant/legal-party binding, transaction participants, sites and user assignments  
**Execution:** Read-only specification; no DDL or migration authorization

## 1. Purpose and terminology

This specification separates legal party, tenant, participant, tenant membership, site link and user assignment. A participant is not a user role, tenant membership, contract signature, or unrestricted transaction permission.

## 2. Relationship cardinalities

| Relationship | Cardinality / invariant |
|---|---|
| Tenant → current verified legal-party binding | Zero or one at any instant; historical versions retained |
| Tenant → transaction participant | At most one row per transaction (`UNIQUE tenant_id, transaction_id`) |
| Transaction → Buyer participant | At most one during draft/invitation; exactly one before approved commercial activation |
| Transaction → Seller participant | At most one during draft/invitation; exactly one before approved commercial activation |
| Transaction → Supplier participants | Zero or more; each Supplier tenant has at most one participant row |
| Participant → user assignments | Zero or more |
| Participant → site links | Zero or more |
| Site link → user assignments | Zero or more; assignment references exact site-link row |
| Tenant membership → assignments | Zero or more; assignment references stable membership identity |
| Site → owner tenant | Exactly one |

## 3. Canonical logical entities and keys

### 3.1 tenant_legal_party_bindings

Required: `id`, `tenant_id`, `legal_party_id`, verification status, effective period, verifier, evidence/audit reference and version metadata.

Candidate key: `UNIQUE(id,tenant_id,legal_party_id)`.

Invariant: no overlapping verified/effective binding periods per tenant. Verified binding requires evidence and verifier attribution. Historical rows remain retained and identity/evidence fields are immutable.

### 3.2 commercial_transactions

Required: `id`, `buyer_party_id`, `seller_party_id`, controlled lifecycle state and audit timestamps. Buyer and Seller legal-party IDs must differ. After contract approval, party changes require formal amendment and legal approval; tenant rebinding cannot rewrite a signed contract snapshot.

### 3.3 transaction_participants

Required: `id`, `tenant_id`, `transaction_id`, `legal_party_id`, `tenant_legal_party_binding_id`, role, participation status, effective period and approval/audit attribution.

Candidate keys:
```sql
PRIMARY KEY (id);
UNIQUE (tenant_id, transaction_id);
UNIQUE (id, tenant_id, transaction_id);
UNIQUE (id, tenant_id, legal_party_id);
```

**Binding-version rule:** `tenant_legal_party_binding_id` is required and NOT NULL. Composite FK references the exact `(id,tenant_id,legal_party_id)` binding row. Participant approval validates that this binding was verified and effective at the approval instant. The historical participant remains pinned to that version if the tenant later rebinds.

DEC-002 permits multiple Supplier tenants on one transaction while limiting each tenant to one participant row per transaction.

Role invariants:
- Buyer legal party equals transaction `buyer_party_id`; Seller equals `seller_party_id`.
- Exactly one Buyer and one Seller participant before commercial activation; never more than one at any point.
- Buyer and Seller tenants are distinct.
- Supplier uses its independent tenant and verified binding; Supplier is not a role inside Buyer/Seller tenant.
- Supplier participation requires explicit approval and bounded operational scope.
- Pending, suspended, revoked or expired participant grants no operational access.

### 3.4 tenant_memberships

Membership row has stable `id`, `tenant_id`, `user_id`, status and effective/audit fields. Candidate key `UNIQUE(id,tenant_id)`. Membership identity is retained; revoke/deactivate rather than hard-delete. If historical rows exist, stable identity and active membership uniqueness must be made explicit.

### 3.5 transaction_site_links

Required: `id`, `tenant_id`, `transaction_id`, `participant_id`, `site_id`, purpose, status, effective period and approval/audit attribution.

Candidate key: `UNIQUE(id,tenant_id,transaction_id,participant_id,site_id)`. It must reference the same participant/tenant/transaction and a site owned by the same tenant.

### 3.6 transaction_access_assignments

Required: `id`, `tenant_id`, `transaction_id`, `participant_id`, `site_id`, `transaction_site_link_id`, `membership_id`, status, effective period and grant/revoke audit fields.

- `membership_id` + `tenant_id` references stable tenant membership `(id,tenant_id)`; canonical assignment does not separately store `subject_user_id`.
- `transaction_site_link_id` + tenant/transaction/participant/site references the exact site-link candidate key.
- Assignment site is NOT NULL for operational access.
- Membership and site link must be active/effective at grant and request time; FK identity alone does not prove lifecycle status.

### 3.7 permission_actions

Canonical normalized action catalog. Assignment-action rows reference a valid assignment and catalog action. Deprecated actions cannot be newly granted.

## 4. Composite integrity contract

1. Assignment `(tenant_id,transaction_id)` → participant `(tenant_id,transaction_id)`.
2. Assignment `(tenant_id,site_id)` → supply site `(tenant_id,id)`.
3. Site link `(tenant_id,transaction_id)` → participant `(tenant_id,transaction_id)`.
4. Site link `(tenant_id,site_id)` → supply site `(tenant_id,id)`.
5. Every participant child tuple `(participant_id,tenant_id,transaction_id)` → participant `(id,tenant_id,transaction_id)`.
6. Participant `(tenant_legal_party_binding_id,tenant_id,legal_party_id)` → binding `(id,tenant_id,legal_party_id)`.
7. Assignment `(membership_id,tenant_id)` → membership `(id,tenant_id)`.
8. Assignment `(transaction_site_link_id,tenant_id,transaction_id,participant_id,site_id)` → site link `(id,tenant_id,transaction_id,participant_id,site_id)`.

These constraints prove tuple consistency, not current approval, effective status or runtime authorization.

## 5. Lifecycle and authorization predicate

Participant lifecycle: `invited → pending → active → suspended/revoked/expired`; reactivation follows approved approval path. Exact transition graph and terminal-state policy require review.

For operational action, require at request time:

```text
valid_session
AND active_tenant_membership_for_assignment.membership_id
AND server_established_tenant_context
AND active_matching_transaction_participant
AND active_exact_transaction_site_link
AND active_assignment_for_exact_membership_and_site
AND active_assignment_action
AND effective_time_window
AND not_revoked_or_suspended
AND applicable_contract_payment_custody_legal_syariah_policy
```

Client-provided tenant, membership, participant, site, role, action, status or offline timestamp is never proof. Missing/stale evidence fails closed. PostgreSQL is authoritative for shared state; SQLite is provisional local/offline state and cannot authorize final replay.

- Buyer/Seller activation/reactivation requires bilateral approval by authorized representatives.
- Supplier additionally requires explicit Supplier participation approval and bounded scope.
- Unilateral protective suspension is permitted.
- Pending participants receive no operational access.
- Revocation/expiry blocks later protected operations and preserves history.
- Reassignment creates new assignment; it does not overwrite revoked history.
- Revocation is not custody transfer; handover requires explicit custody acceptance and server confirmation.

## 6. Authority exclusions

Supplier participation/assignment never grants contract signing/amendment, payment approval/settlement/ledger authority, goods-release authority, or access to unrelated tenants/unassigned sites.

## 7. Remaining review items before schema freeze

- Confirm actual membership-history model and stable membership identity.
- Approve trigger/normalized relation strategy for role/legal-party matching and Buyer/Seller tenant distinctness.
- Confirm exact approval evidence/actor-authority schema.
- Finalize status transition graph and timestamp precision.
- Define non-party service-provider delegation.
- Finalize legal jurisdiction, identifiers, retention and verification evidence.
- Close PostgreSQL RLS, SQLite runtime provenance and cross-engine parity evidence.

## 8. Governance

Logical contract only. No source-code change, DDL, migration, database execution, PR, merge, deployment or shared/live test is authorized.
