# CANONICAL-ENTITY-KEY-CONSTRAINT-MAPPING-001

**Status:** INTEGRITY MAPPING COMPLETE FOR REVIEW — NOT FROZEN  
**Date:** 2026-11-10  
**Target:** Mobile / PostgreSQL authoritative + SQLite offline persistence  
**Source baseline:** Web review package `docs/integrated-review-package-p0`, commit `dadedeebdb1e606e7cd436d28935b8f510693a00`  
**Execution mode:** Read-only design; no DDL, migration or database execution

## 1. Objective and freeze boundary

This document defines the canonical logical entity inventory, candidate keys, foreign keys, check/unique/temporal constraints and PostgreSQL–SQLite enforcement mapping. Four previously open integrity gaps now have one recommended resolution each:

1. Participant pins the exact verified tenant/legal-party binding version.
2. Buyer and Seller roles use independent filtered unique indexes.
3. Assignment references a stable tenant-membership row, not a free-standing user ID.
4. Assignment references the exact site-link row through a composite FK.

These resolutions are **complete as a design proposal for review**, not approved physical DDL. The mapping does not freeze types, migrations, index rollout, triggers, or runtime behavior.

**Domain authority:** DEC-001–DEC-005 approved. DEC-006 RLS design open; DEC-007 SQLite runtime provenance not verified; DEC-008 PostgreSQL/SQLite physical parity not verified.

## 2. Canonical entity inventory

| Entity | Responsibility | Tenant scope |
|---|---|---|
| `tenants` | Independent organization identity/admin/isolation | Root |
| `tenant_memberships` | Stable user membership identity and tenant role grants | Tenant |
| `legal_parties` | Contractual legal identity | Global/legal |
| `tenant_legal_party_bindings` | Versioned verified tenant–legal-party link | Tenant |
| `commercial_transactions` | Transaction and Buyer/Seller legal parties | Multi-party |
| `transaction_participants` | Canonical tenant-to-transaction party participation | Tenant + transaction |
| `supply_sites` | Site owned by one tenant | Tenant |
| `transaction_site_links` | Participant-scoped transaction/site authorization relationship | Tenant + transaction + site |
| `transaction_access_assignments` | Membership-specific operational grant | Tenant + participant + site link |
| `permission_actions` | Controlled action vocabulary | Shared catalog |
| `transaction_access_assignment_actions` | Assignment-to-action grants | Assignment |
| `audit_events` | Attributable immutable/security-relevant event history | Tenant/transaction as applicable |

## 3. Canonical candidate-key map

### 3.1 Tenant membership and legal identity

| Entity | Primary key | Required candidate/unique keys | Required references |
|---|---|---|---|
| `tenants` | `id` | PK | — |
| `tenant_memberships` | `id` | `UNIQUE(id,tenant_id)`; `UNIQUE(tenant_id,user_id)` only if membership history is not multi-row | `tenant_id → tenants.id`; `user_id → canonical users.id` |
| `legal_parties` | `id` | Jurisdiction-scoped registration identifier uniqueness only after D-06 legal review | — |
| `tenant_legal_party_bindings` | `id` | `UNIQUE(id,tenant_id,legal_party_id)` | `tenant_id → tenants.id`; `legal_party_id → legal_parties.id` |

**Membership resolution:** assignment stores `membership_id` + `tenant_id`; it does not duplicate `subject_user_id`. The assigned user is derived through the referenced membership row. This avoids a user ID that is not tied to a tenant membership identity. Membership rows are stable identities; revoke/deactivate rather than hard-delete. If the existing schema stores multiple membership-history rows, introduce a stable membership identity/current-row contract before implementation; do not weaken the FK to a user-only reference.

**DEC-001 binding lifecycle:** a tenant has at most one verified/effective binding at any instant. Binding history is versioned and retained. Verified rows require verifier attribution and evidence. Use half-open intervals `[effective_from,effective_until)`; NULL `effective_until` means unbounded future. Adjacent intervals are valid; overlapping verified intervals for one tenant are not.

### 3.2 Transaction and participant keys

| Entity | Primary key | Required candidate/unique keys | Required references |
|---|---|---|---|
| `commercial_transactions` | `id` | `UNIQUE(id,buyer_party_id,seller_party_id)` only if used as a composite FK target | Buyer/Seller legal party FKs |
| `transaction_participants` | `id` | `UNIQUE(tenant_id,transaction_id)`; `UNIQUE(id,tenant_id,transaction_id)`; `UNIQUE(id,tenant_id,legal_party_id)` | Tenant, transaction, legal party, exact binding version |

Participant required columns include `tenant_id`, `transaction_id`, `legal_party_id`, `tenant_legal_party_binding_id`, `participant_role`, lifecycle status, effective period, approval actor/reference and audit timestamps.

**Resolved GAP-1 — binding version:** `tenant_legal_party_binding_id` is required and NOT NULL for every participant. Enforce:

```sql
UNIQUE (id, tenant_id, legal_party_id)
FOREIGN KEY (tenant_legal_party_binding_id, tenant_id, legal_party_id)
  REFERENCES tenant_legal_party_bindings (id, tenant_id, legal_party_id)
```

The referenced binding row is the exact verified legal-identity version approved for this participant. It must have been verified and effective at participant approval time. Later tenant rebinding does not rewrite historical participant identity or retarget the FK. Binding identity columns and verification evidence are immutable; lifecycle closure is recorded by a controlled effective-until update plus audit. The FK proves tuple identity, not verification status or effective time; those require a transactionally enforced lifecycle check and backend authorization.

**Resolved GAP-2 — Buyer/Seller role uniqueness:** enforce one Buyer and one Seller participant per transaction with separate filtered unique indexes:

```sql
CREATE UNIQUE INDEX uq_transaction_participants_one_buyer
  ON transaction_participants (transaction_id)
  WHERE participant_role = 'buyer';

CREATE UNIQUE INDEX uq_transaction_participants_one_seller
  ON transaction_participants (transaction_id)
  WHERE participant_role = 'seller';
```

The same partial-index predicates are supported by PostgreSQL and SQLite (SQLite 3.8.0+). Pin and verify the deployed SQLite version before freeze. DEC-002's `UNIQUE(tenant_id,transaction_id)` remains independently required. Supplier rows remain zero-to-many, each from a different Supplier tenant.

Buyer/Seller legal-party matching is role-dependent: Buyer participant `legal_party_id` equals transaction `buyer_party_id`; Seller equals `seller_party_id`. Enforce through reviewed insert/update/activation triggers or a normalized transaction-party relation with composite FKs. Also enforce Buyer and Seller tenant IDs differ before transaction activation. Partial unique indexes alone do not prove these cross-row invariants.

### 3.3 Site and assignment keys

| Entity | Primary key | Required candidate/unique keys | Required references |
|---|---|---|---|
| `supply_sites` | `id` | `UNIQUE(tenant_id,id)` | `tenant_id → tenants.id` |
| `transaction_site_links` | `id` | `UNIQUE(id,tenant_id,transaction_id,participant_id,site_id)` | Participant and tenant-owned site |
| `transaction_access_assignments` | `id` | `UNIQUE(id,tenant_id,transaction_id,participant_id,site_id)` only if a downstream child FK requires it | Participant, site, exact site-link row, membership |
| `transaction_access_assignment_actions` | Composite `(assignment_id,action_code)` | PK on pair | Assignment + action catalog |
| `permission_actions` | `action_code` | PK | — |
| `audit_events` | `id` | PK; idempotency/correlation uniqueness separately specified | Actor/tenant/transaction references as retained |

**Resolved GAP-3 — membership consistency:** `transaction_access_assignments` stores `membership_id` and `tenant_id`, with:

```sql
UNIQUE (id, tenant_id) -- on tenant_memberships
FOREIGN KEY (membership_id, tenant_id)
  REFERENCES tenant_memberships (id, tenant_id)
```

The assignment's effective user is obtained from `tenant_memberships.user_id`. No independent `subject_user_id` is stored in the canonical assignment row. Membership status must still be active at authorization time; the FK does not prove active status. Membership deletion is RESTRICT; revocation is a status transition with audit history.

**Resolved GAP-4 — exact site-link consistency:** `transaction_access_assignments` stores `transaction_site_link_id` and retains `tenant_id`, `transaction_id`, `participant_id`, `site_id` for tuple integrity. Enforce:

```sql
UNIQUE (id, tenant_id, transaction_id, participant_id, site_id)
  -- on transaction_site_links

FOREIGN KEY (
  transaction_site_link_id, tenant_id, transaction_id, participant_id, site_id
)
REFERENCES transaction_site_links (
  id, tenant_id, transaction_id, participant_id, site_id
)
```

This pins the assignment to the exact site-link record, including its historical identity, and prevents assignment to a site not linked to that participant/transaction. It does not prove that the referenced link is currently active; activation and every protected operation must validate link status and effective time. Revoke/expire a site link to deny subsequent operations; do not silently repoint existing assignment history.

## 4. Mandatory composite foreign-key contract

Parent candidate keys:

```sql
transaction_participants:
  UNIQUE (tenant_id, transaction_id)
  UNIQUE (id, tenant_id, transaction_id)
  UNIQUE (id, tenant_id, legal_party_id)

supply_sites:
  UNIQUE (tenant_id, id)

transaction_site_links:
  UNIQUE (id, tenant_id, transaction_id, participant_id, site_id)

tenant_memberships:
  UNIQUE (id, tenant_id)
```

| ID | Child | Child columns | Parent | Parent columns | Purpose |
|---|---|---|---|---|---|
| CFK-001 | transaction_access_assignments | `(tenant_id,transaction_id)` | transaction_participants | `(tenant_id,transaction_id)` | Assignment tenant participates |
| CFK-002 | transaction_access_assignments | `(tenant_id,site_id)` | supply_sites | `(tenant_id,id)` | Site belongs to same tenant |
| CFK-003 | transaction_site_links | `(tenant_id,transaction_id)` | transaction_participants | `(tenant_id,transaction_id)` | Site-link tenant participates |
| CFK-004 | transaction_site_links | `(tenant_id,site_id)` | supply_sites | `(tenant_id,id)` | Linked site belongs to same tenant |
| CFK-005 | Every child storing participant_id | `(participant_id,tenant_id,transaction_id)` | transaction_participants | `(id,tenant_id,transaction_id)` | Exact participant tuple |
| CFK-006 | transaction_participants | `(tenant_legal_party_binding_id,tenant_id,legal_party_id)` | tenant_legal_party_bindings | `(id,tenant_id,legal_party_id)` | Exact binding version |
| CFK-007 | transaction_access_assignments | `(membership_id,tenant_id)` | tenant_memberships | `(id,tenant_id)` | Assignment belongs to tenant member |
| CFK-008 | transaction_access_assignments | `(transaction_site_link_id,tenant_id,transaction_id,participant_id,site_id)` | transaction_site_links | `(id,tenant_id,transaction_id,participant_id,site_id)` | Assignment uses exact linked site |

CFK-001–004 are the four original mandatory composite FKs. CFK-005–008 close participant identity, binding version, membership and exact site-link consistency.

## 5. Check, unique, temporal and cross-row constraints

| ID | Entity | Constraint | Enforcement |
|---|---|---|---|
| CK-001 | legal_parties | Required legal name, country code and controlled status | CHECK + D-06 legal review |
| CK-002 | tenant_legal_party_bindings | `effective_until IS NULL OR effective_until > effective_from` | CHECK |
| CK-003 | tenant_legal_party_bindings | Verified requires verifier + evidence reference | CHECK |
| TM-001 | tenant_legal_party_bindings | No overlapping verified intervals per tenant | Serialized trigger / transaction on both engines |
| UQ-001 | transaction_participants | `UNIQUE(tenant_id,transaction_id)` | Native UNIQUE |
| UQ-002 | transaction_participants | One Buyer role per transaction | Partial unique index |
| UQ-003 | transaction_participants | One Seller role per transaction | Partial unique index |
| CK-004 | transaction_participants | Role in buyer/seller/supplier | CHECK |
| CK-005 | transaction_participants | Valid effective interval/status | CHECK + lifecycle service |
| CK-006 | commercial_transactions | Buyer legal party differs from Seller | CHECK |
| TR-001 | transaction_participants | Role's legal_party_id equals corresponding transaction party | Trigger or normalized transaction-party relation |
| TR-002 | transaction_participants | Binding was verified/effective at approval timestamp | Trigger/serialized transaction + backend approval |
| TR-003 | transaction_participants | Buyer/Seller tenant identities differ before activation | Trigger/lifecycle transaction |
| CK-007 | transaction_site_links | Valid purpose/status/effective interval | CHECK + controlled transition |
| CK-008 | transaction_access_assignments | Operational site link is mandatory; site_id NOT NULL | NOT NULL + CFK-008 |
| TR-004 | transaction_access_assignments | Referenced membership is active at grant and request time | Backend authorization; optionally trigger at grant |
| TR-005 | transaction_access_assignments | Referenced site link is active/effective at grant and request time | Backend authorization; optionally trigger at grant |
| CK-009 | permission_actions | Canonical code and lifecycle status | CHECK/catalog governance |
| FK-009 | assignment-action rows | Assignment/action pair exists | Composite FK / PK |
| AU-001 | audit_events | Append-only to ordinary application roles | Privileges + controlled trigger |

Row-local CHECK constraints do not replace cross-row or temporal enforcement. All trigger paths must be transactionally safe under concurrent insert/update, fail closed, and emit attributable audit events.

## 6. PostgreSQL–SQLite constraint mapping

| Rule | PostgreSQL | SQLite | Parity contract |
|---|---|---|---|
| Primary/candidate keys | PK + UNIQUE | PK + UNIQUE | Same duplicate rejection |
| CFK-001–008 | Native composite FKs | Native composite FKs; `PRAGMA foreign_keys=ON` per connection | Same tuple rejection |
| Buyer/Seller role uniqueness | Two partial unique indexes | Same two partial unique indexes; require SQLite ≥3.8.0 | Duplicate role rejected; Supplier cardinality unchanged |
| Binding version | Composite FK to binding candidate key | Same composite FK | Cross-tenant/legal-party mismatch rejected |
| Membership assignment | Composite FK to membership identity | Same composite FK | Cross-tenant membership rejected |
| Assignment/site-link | Five-column composite FK to exact link candidate key | Same composite FK | Unlinked or mismatched site assignment rejected |
| Effective interval validity | CHECK | CHECK | Same half-open interval boundaries |
| Binding overlap | BEFORE trigger locks tenant row (`SELECT ... FOR UPDATE`), checks overlap, then writes in same transaction | BEFORE INSERT/UPDATE trigger rejects overlap; SQLite write transaction serialization required | Concurrent overlapping binding attempts: exactly one succeeds |
| Role/legal-party match | Trigger or normalized party relation + FK | Trigger or normalized party relation + FK | Buyer/Seller mismatch rejected |
| Buyer/Seller distinct tenants | Transaction activation trigger/service transaction | Trigger/service transaction | Same rejection before activation |
| Active membership/site link | Backend authorization at request time; grant-time validation | Backend authorization; local copy is provisional | Revocation/expiry denies subsequent operation |
| Tenant isolation | RLS + backend authorization | No trusted local RLS boundary; local DB is untrusted | SQLite cannot authorize final/shared operation |
| Audit immutability | Privilege boundary + controlled trigger | Trigger + controlled write access | Ordinary application role cannot rewrite audit history |
| Idempotency | Unique server command/idempotency key | Unique local command key | Server deduplicates replay |

**Interval semantics:** timestamps must use one canonical UTC representation and consistent precision across engines. Use half-open intervals `[from,until)`: `from <= now AND (until IS NULL OR now < until)`. Adjacent intervals do not overlap. SQLite must pin one timestamp representation/precision before schema freeze.

**Concurrency:** PostgreSQL overlap enforcement must serialize per tenant (e.g. lock the tenant row before checking and writing). SQLite writes must use an explicit write transaction; a trigger check must run within that transaction. A non-serialized application pre-check is insufficient.

**SQLite connection invariant:** `PRAGMA foreign_keys = ON` must be set and verified for every connection, including tests, workers and reopen paths. Pin actual runtime version before using partial indexes/triggers. SQLite local state is never authority for shared access or final replay.

## 7. Authorization and lifecycle invariants

- Only active participants, active memberships, active site links, active assignments and active action grants within their effective intervals can authorize.
- Buyer/Seller activation/reactivation requires bilateral approval. Supplier additionally requires explicit Supplier approval and bounded operational scope.
- A participant's binding-version reference remains immutable for historical identity.
- Membership revocation denies all assignments through that membership without deleting audit history.
- Site-link revocation/expiry denies dependent assignments; reassignment requires a new explicit link/assignment lifecycle, not silent tuple mutation.
- `site_id = NULL` never means unrestricted access.
- Supplier never gains contract signing/amendment, payment/ledger, or goods-release authority by operational assignment.
- Contract, payment, custody, legal, Syariah and release policies remain independent gates.
- Client-supplied tenant, membership, participant, site, role, action, status or offline timestamp is never authorization proof.

## 8. Index requirements

Candidate indexes (final selection requires workload/query-plan review):

| ID | Table | Candidate index |
|---|---|---|
| IDX-001 | tenant_legal_party_bindings | `(tenant_id,verification_status,effective_from)` |
| IDX-002 | tenant_legal_party_bindings | `(legal_party_id,verification_status)` |
| IDX-003 | transaction_participants | `(tenant_id,participation_status,effective_from)` |
| IDX-004 | transaction_participants | `(transaction_id,participant_role,participation_status)` |
| IDX-005 | transaction_site_links | `(tenant_id,transaction_id,site_id,link_status)` |
| IDX-006 | transaction_access_assignments | `(tenant_id,membership_id,assignment_status)` |
| IDX-007 | transaction_access_assignments | `(participant_id,transaction_id,site_id)` |
| IDX-008 | audit_events | `(tenant_id,occurred_at)` |
| IDX-009 | transaction_access_assignment_actions | `(assignment_id,action_code)` |

Add/verify indexes on child FK column tuples where the engine does not create them automatically. Do not create redundant indexes duplicating PK/UNIQUE/partial indexes without query-plan evidence.

## 9. Remaining decisions before schema freeze

1. Confirm exact table/column names against current canonical DDL and legacy schema.
2. Confirm whether `tenant_memberships` has stable rows or historical duplicates; if multiple history rows, formalize stable membership identity and active-row uniqueness.
3. Select trigger vs normalized transaction-party relation for role/legal-party match.
4. Pin PostgreSQL version, SQLite runtime minimum/version, UUID storage, UTC timestamp precision and transaction isolation.
5. Finalize non-party delegated provider model (D-03).
6. Finalize role/action allowlist and grant composition (D-05).
7. Legal/compliance review of jurisdiction identifiers, verification evidence and retention (D-06).
8. Close DEC-006 RLS design, DEC-007 SQLite provenance and DEC-008 parity evidence.
9. Reconcile legacy data and server authorization code against this domain baseline.

## 10. Freeze exit criteria

Schema freeze is not permitted until:
- the four gap resolutions and all candidate keys/FK targets are accepted;
- all row-local, temporal and cross-table constraints have an explicit enforcement owner per engine;
- the same positive/negative acceptance corpus passes on disposable PostgreSQL and SQLite databases;
- RLS policies and non-bypass role are reviewed and tested;
- actual SQLite runtime/schema and per-connection FK enforcement are evidenced;
- legacy data disposition and migration/rollback plan are reviewed;
- Web, Mobile and Desktop API/authorization contracts match the canonical schema;
- all critical open decisions have an explicit owner and disposition.

## 11. Governance

This mapping is a review-ready logical specification, not final DDL. No schema freeze, source implementation, migration creation/execution, database mutation, shared/live testing, PR, merge, deployment or staging/production activity is authorized.
