# CANONICAL-ENTITY-KEY-CONSTRAINT-MAPPING-001

**Status:** LOGICAL MAPPING FOR REVIEW — NOT FROZEN  
**Date:** 2026-11-10  
**Target:** Mobile / PostgreSQL authoritative + SQLite offline persistence  
**Source baseline:** Web review package `docs/integrated-review-package-p0`, commit `dadedeebdb1e606e7cd436d28935b8f510693a00`  
**Execution mode:** Read-only design; no DDL, migration or database execution

## 1. Objective and freeze boundary

This document consolidates the logical entity inventory, primary/candidate keys, foreign-key relationships, check/unique/temporal constraints and PostgreSQL–SQLite enforcement mapping.

It is a design artifact. It does not freeze physical DDL, select final UUID storage implementation, approve migration ordering, or authorize database changes. Candidate refinements identified below remain review items.

**Authority:** DEC-001–DEC-005 are approved domain invariants. DEC-006 RLS design is open; DEC-007 SQLite runtime provenance is unverified; DEC-008 physical parity is unverified.

## 2. Canonical entity inventory

| Entity | Responsibility | Tenant scope |
|---|---|---|
| `tenants` | Independent organization identity/admin/isolation | Root |
| `tenant_memberships` | User membership and tenant role grants | Tenant |
| `legal_parties` | Contractual legal identity | Global/legal |
| `tenant_legal_party_bindings` | Versioned verified tenant–legal-party link | Tenant |
| `commercial_transactions` | Transaction and Buyer/Seller legal parties | Multi-party |
| `transaction_participants` | Canonical tenant-to-transaction party participation | Tenant + transaction |
| `supply_sites` | Site owned by one tenant | Tenant |
| `transaction_site_links` | Participant-scoped transaction/site authorization relationship | Tenant + transaction + site |
| `transaction_access_assignments` | User-specific operational grant | Tenant + participant + site |
| `permission_actions` | Controlled action vocabulary | Shared catalog |
| `transaction_access_assignment_actions` | Assignment-to-action grants | Assignment |
| `audit_events` | Attributable immutable/security-relevant event history | Tenant/transaction as applicable |

## 3. Entity key map

### 3.1 Root identity and legal identity

| Entity | Primary key | Required candidate/unique keys | Required references |
|---|---|---|---|
| tenants | `id` | `UNIQUE(id)` implicit in PK | — |
| tenant_memberships | `id` | **Review:** `UNIQUE(tenant_id,user_id)` or equivalent membership identity; must support active membership lookup | `tenant_id → tenants.id`; user identity → canonical users table |
| legal_parties | `id` | Jurisdiction-scoped registration identifier uniqueness only after D-06 legal review | — |
| tenant_legal_party_bindings | `id` | `UNIQUE(id,tenant_id,legal_party_id)` | `tenant_id → tenants.id`; `legal_party_id → legal_parties.id` |

**DEC-001:** A tenant has at most one verified and currently effective binding at any instant. Retain historical versions. Verified records require verifier attribution and evidence. The temporal rule is not equivalent to a simple `UNIQUE(tenant_id,status)`.

**Review refinement:** transaction participants should identify the exact binding version used at approval time, e.g. `tenant_legal_party_binding_id`, and reference `(binding_id,tenant_id,legal_party_id)`. Without a version reference, a later tenant rebinding can make historical participant identity ambiguous. This refinement is proposed, not yet approved.

### 3.2 Transaction and participants

| Entity | Primary key | Required candidate/unique keys | Required references |
|---|---|---|---|
| commercial_transactions | `id` | Candidate key for `(id,buyer_party_id,seller_party_id)` if composite party checks are implemented declaratively | `buyer_party_id → legal_parties.id`; `seller_party_id → legal_parties.id` |
| transaction_participants | `id` | **DEC-002:** `UNIQUE(tenant_id,transaction_id)`; `UNIQUE(id,tenant_id,transaction_id)` | `tenant_id → tenants.id`; `transaction_id → commercial_transactions.id`; `legal_party_id → legal_parties.id`; proposed binding-version composite FK |

Participant role cardinality:
- `participant_role CHECK IN ('buyer','seller','supplier')`.
- At most one Buyer participant per transaction.
- At most one Seller participant per transaction.
- Buyer and Seller tenant identities must differ.
- Zero or more Supplier participants; each Supplier tenant remains independently governed.
- DEC-002 already prevents the same tenant from creating multiple participant rows for the same transaction.

**Physical enforcement proposal:** PostgreSQL partial unique indexes on `(transaction_id)` filtered separately for `participant_role='buyer'` and `participant_role='seller'`; SQLite partial unique indexes where supported by the minimum runtime version, otherwise equivalent triggers. Confirm supported SQLite version before freeze. This is not an approval to create those indexes.

**Role/legal-party matching:** Buyer participant's `legal_party_id` must equal transaction `buyer_party_id`; Seller participant's `legal_party_id` must equal `seller_party_id`. A normal FK cannot express a role-dependent reference to one of two transaction columns. Use a reviewed trigger/constraint-trigger or a normalized transaction-party relation with composite FK. Do not rely only on application code without negative tests.

### 3.3 Site and assignment entities

| Entity | Primary key | Required candidate/unique keys | Required references |
|---|---|---|---|
| supply_sites | `id` | `UNIQUE(tenant_id,id)` | `tenant_id → tenants.id` |
| transaction_site_links | `id` | `UNIQUE(id,tenant_id,transaction_id,participant_id,site_id)` if selected as target for child consistency | Four-part relationship described below |
| transaction_access_assignments | `id` | `UNIQUE(id,tenant_id,transaction_id,participant_id,site_id)` if selected for action child consistency | Participant, site, membership, site-link relationships |
| transaction_access_assignment_actions | Composite `(assignment_id,action_code)` | PK or UNIQUE on pair | `assignment_id → transaction_access_assignments.id`; `action_code → permission_actions.action_code` |
| permission_actions | `action_code` | PK; canonical unique code | — |
| audit_events | `id` | PK; idempotency/correlation uniqueness as separately specified | Actor/tenant/transaction references where retained |

The exact composite candidate keys for site links and assignments depend on whether downstream FKs need to prove exact site-link membership or action-grant ownership. Do not add redundant unique indexes without a declared FK consumer.

## 4. Composite foreign-key contract

### 4.1 Parent candidate keys

Required parent keys:

```sql
transaction_participants:
  UNIQUE (tenant_id, transaction_id)
  UNIQUE (id, tenant_id, transaction_id)

supply_sites:
  UNIQUE (tenant_id, id)
```

### 4.2 Mandatory composite FKs

| ID | Child | Child columns | Parent | Parent columns | Purpose |
|---|---|---|---|---|---|
| CFK-001 | transaction_access_assignments | `(tenant_id,transaction_id)` | transaction_participants | `(tenant_id,transaction_id)` | Assignment tenant participates in transaction |
| CFK-002 | transaction_access_assignments | `(tenant_id,site_id)` | supply_sites | `(tenant_id,id)` | Site belongs to same tenant |
| CFK-003 | transaction_site_links | `(tenant_id,transaction_id)` | transaction_participants | `(tenant_id,transaction_id)` | Site link tenant participates in transaction |
| CFK-004 | transaction_site_links | `(tenant_id,site_id)` | supply_sites | `(tenant_id,id)` | Linked site belongs to same tenant |

### 4.3 Participant consistency FK

Every child storing `participant_id` must also enforce:

```sql
FOREIGN KEY (participant_id, tenant_id, transaction_id)
REFERENCES transaction_participants (id, tenant_id, transaction_id)
```

This is additional to CFK-001–CFK-004, not a substitute for them.

### 4.4 Assignment-to-site-link consistency

A site-owner FK alone does not prove that the assigned participant is linked to that site for that transaction. Required invariant:

```text
assignment.(tenant_id, transaction_id, participant_id, site_id)
must match an active transaction_site_links row
with the same tuple and effective period.
```

**Review options:** (a) introduce a composite candidate key on `transaction_site_links` and FK from assignment; or (b) enforce activation/assignment lifecycle with a serialized backend transaction and engine-specific trigger/constraint logic. Select one before freeze and test races.

### 4.5 Membership-to-assignment consistency

An assignment's `subject_user_id` must belong to the same `tenant_id`. Proposed candidate key on membership: `UNIQUE(tenant_id,user_id)`, referenced by assignment `(tenant_id,subject_user_id)`. If membership history permits multiple rows per user/tenant, model a stable membership identity and reference that ID plus tenant instead. Membership active/revoked state remains a runtime authorization check.

## 5. Check, unique and temporal constraints

| ID | Entity | Constraint | Required behavior |
|---|---|---|---|
| CK-001 | legal_parties | required legal name, country code and controlled legal status | Reject invalid/missing identity data |
| CK-002 | tenant_legal_party_bindings | valid effective interval | `effective_until IS NULL OR effective_until > effective_from` |
| CK-003 | tenant_legal_party_bindings | verified requires verifier + evidence | Reject unsubstantiated verified binding |
| TM-001 | tenant_legal_party_bindings | no overlapping verified/effective periods per tenant | DEC-001; temporal exclusion/serialization or trigger |
| UQ-001 | transaction_participants | `UNIQUE(tenant_id,transaction_id)` | DEC-002 |
| CK-004 | transaction_participants | role in controlled vocabulary | Reject unknown role |
| CK-005 | transaction_participants | valid effective period/status | Reject invalid range/state |
| UQ-002 | transaction_participants | one Buyer role per transaction | Partial unique index or equivalent |
| UQ-003 | transaction_participants | one Seller role per transaction | Partial unique index or equivalent |
| CK-006 | commercial_transactions | Buyer legal party differs from Seller legal party | Reject same legal party on both sides |
| TR-001 | transaction_participants | Buyer/Seller legal party matches transaction role | Reject mismatched party identity |
| TR-002 | transaction_participants | tenant binding version matches tenant + legal party | Reject stale/mismatched binding reference |
| CK-007 | transaction_site_links | valid status, purpose and effective period | Reject unknown/invalid state |
| CK-008 | transaction_access_assignments | operational assignment requires non-null site | NULL is not broad scope |
| TR-003 | transaction_access_assignments | exact active site link exists for participant/site/transaction | Reject unlinked site assignment |
| TR-004 | transaction_access_assignments | subject user belongs to assignment tenant | Reject cross-tenant/non-member subject |
| FK-005 | assignment child | assignment/action pair references valid assignment and catalog action | No orphan/unknown action |
| CK-009 | permission_actions | controlled code and active/deprecated lifecycle | Deprecated action cannot be newly granted |
| AU-001 | audit_events | append-only / restricted mutation | Preserve attributable history |

Check constraints validate row-local conditions. Temporal overlap, cross-table role/legal-party matching, membership lifecycle, site-link activity and approval authority require exclusion/trigger/serialized service enforcement and backend authorization.

## 6. Lifecycle and authorization invariants

- Participant states: invited, pending, active, suspended, revoked, expired.
- Assignment/site-link states: pending, active, suspended, revoked, expired.
- Only active rows within effective periods can satisfy authorization.
- Pending participant receives no operational access.
- Supplier needs own tenant, verified binding, explicit participation approval and bounded site/action/time scope.
- `site_id = NULL` never means unrestricted access.
- Contract, payment, custody, legal, Syariah and goods-release policies remain separate gates.
- Revocation invalidates later protected operations and offline replay; local SQLite active state is not authority.
- Revocation does not silently transfer custody.

## 7. PostgreSQL–SQLite enforcement mapping

| Logical rule | PostgreSQL | SQLite | Parity requirement |
|---|---|---|---|
| PK / UNIQUE | Native PK/unique | Native PK/unique | Same duplicate rejection |
| Composite FKs | Native composite FK | Native composite FK; enable per connection | Same tuple rejection |
| Role/status/action vocabulary | CHECK or governed enum | CHECK | Same accepted values |
| Effective interval validity | CHECK | CHECK | Same boundary behavior |
| Binding overlap | Range exclusion constraint or serialized transaction | Trigger + serialized write transaction | Same overlap outcomes |
| Role/legal-party match | Constraint trigger or normalized relation + FK | Trigger | Same role mismatch rejection |
| Assignment/site-link consistency | Composite FK or transactionally serialized enforcement | Composite FK or trigger | Same mismatched tuple rejection |
| Membership/assignment consistency | Composite FK + runtime active membership check | Composite FK + runtime check | Same identity tuple rejection |
| Tenant isolation | RLS + backend authorization | Backend authorization; local DB untrusted | No local authority |
| Audit immutability | Privilege boundary + controlled trigger | Trigger + controlled write access | Same ordinary-user mutation denial |
| Idempotency | Unique server command/idempotency key | Unique local command key | Server deduplicates replay |

SQLite must execute `PRAGMA foreign_keys = ON` for every connection. The minimum SQLite runtime version and trigger semantics must be pinned before freeze. PostgreSQL RLS is defense-in-depth and cannot replace backend authorization.

## 8. Index requirements

Carry forward the source candidates for review:

| ID | Table | Candidate index |
|---|---|---|
| IDX-001 | tenant_legal_party_bindings | `(tenant_id,verification_status,effective_from)` |
| IDX-002 | tenant_legal_party_bindings | `(legal_party_id,verification_status)` |
| IDX-003 | transaction_participants | `(tenant_id,participation_status,effective_from)` |
| IDX-004 | transaction_participants | `(transaction_id,participant_role,participation_status)` |
| IDX-005 | transaction_site_links | `(tenant_id,transaction_id,site_id,link_status)` |
| IDX-006 | transaction_access_assignments | `(tenant_id,subject_user_id,assignment_status)` |
| IDX-007 | transaction_access_assignments | `(participant_id,transaction_id,site_id)` |
| IDX-008 | audit_events | `(tenant_id,occurred_at)` |
| IDX-009 | transaction_access_assignment_actions | `(assignment_id,action_code)` |

Index coverage for all child FK columns must be checked. Final index selection depends on real query patterns and query plans.

## 9. Unresolved mapping decisions before schema freeze

1. Approve or reject participant binding-version FK.
2. Approve Buyer/Seller role cardinality physical enforcement.
3. Choose declarative vs trigger/serialized assignment-to-site-link enforcement.
4. Finalize membership identity/history and assignment membership FK.
5. Finalize exact transaction-wide exception representation without NULL-site semantics.
6. Finalize non-party delegated provider model (D-03).
7. Finalize role/action allowlist and grant composition (D-05).
8. Legal/compliance decision on jurisdiction identifiers, verification evidence and retention (D-06).
9. Pin PostgreSQL version/extensions, SQLite minimum version, UUID representation and timestamp precision.
10. Complete DEC-006 RLS design, DEC-007 SQLite provenance and DEC-008 parity evidence.
11. Reconcile legacy schema/data and server authorization code against this domain baseline.

## 10. Freeze exit criteria

Schema freeze is not permitted until:
- all candidate keys and FK targets are accepted;
- all row-level, temporal and cross-table constraints have an explicit enforcement owner per engine;
- the same positive/negative acceptance corpus is defined for PostgreSQL and SQLite;
- RLS policy and non-bypass role are reviewed;
- actual SQLite runtime schema and FK enforcement are evidenced;
- legacy data disposition and migration/rollback plan are reviewed;
- cross-platform API and authorization contracts match the canonical schema;
- every critical open decision has an explicit owner and disposition.

## 11. Governance

This mapping is a review baseline, not final DDL. No schema freeze, source implementation, migration creation/execution, database mutation, shared/live testing, PR creation, merge, deployment or staging/production activity is authorized.
