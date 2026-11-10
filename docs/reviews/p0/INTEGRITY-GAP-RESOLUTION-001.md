# INTEGRITY-GAP-RESOLUTION-001

**Status:** FOUR GAP DESIGNS RESOLVED — REVIEW PENDING  
**Date:** 2026-11-10  
**Scope:** Binding version, Buyer/Seller uniqueness, membership consistency, assignment/site-link consistency  
**Authority:** DEC-001–DEC-005 approved; this document does not create a new domain DEC.

## 1. Decision summary

| Gap | Resolution | Integrity guarantee | Runtime caveat |
|---|---|---|---|
| G-01 Binding version | Participant has NOT NULL `tenant_legal_party_binding_id`; composite FK to binding `(id,tenant_id,legal_party_id)` | Historical participant is pinned to exact tenant/legal-party binding row | FK cannot prove binding was verified/effective at approval instant; controlled approval transaction validates it |
| G-02 Buyer/Seller role uniqueness | Two partial unique indexes on `transaction_id`, one per role | At most one Buyer and at most one Seller participant per transaction | Exactly-one-before-activation and role/legal-party match require lifecycle/cross-row enforcement |
| G-03 Membership consistency | Assignment stores `membership_id,tenant_id`; composite FK to membership `(id,tenant_id)` | Assignment cannot reference a membership belonging to another tenant | Membership active/revoked status is checked at request time; membership rows are retained |
| G-04 Assignment/site-link consistency | Assignment stores `transaction_site_link_id` and composite FK to exact link `(id,tenant_id,transaction_id,participant_id,site_id)` | Assignment cannot target a site/participant/transaction tuple other than the referenced link | Link status/effective time checked at grant and each protected operation |

## 2. G-01 — immutable binding-version reference

Participant row must carry a NOT NULL binding-version ID and composite FK. The binding row's tenant/legal-party identity and verification evidence are immutable. Rebinding creates a new binding row/version; it does not rewrite existing participant references. The participant's binding must have been verified and effective at approval time. Historical participants remain pinned even after that binding is no longer current.

Reject:
- binding ID from another tenant;
- binding ID for another legal party;
- participant without a binding reference;
- unverified/ineffective binding at approval.

## 3. G-02 — Buyer/Seller partial uniqueness

Use one partial unique index per role. The same predicates are used in PostgreSQL and SQLite. Pin SQLite >= 3.8.0 and verify the actual embedded runtime before freeze.

Reject:
- second Buyer role for the same transaction;
- second Seller role for the same transaction.

Still require:
- Buyer legal party matches transaction buyer_party_id;
- Seller legal party matches transaction seller_party_id;
- Buyer and Seller tenant IDs differ;
- exactly one Buyer and Seller before transaction enters approved commercial state.

These cross-row/lifecycle conditions are not supplied by partial unique indexes alone.

## 4. G-03 — stable membership identity

Assignment references a membership row, not an independent subject_user_id. The user is derived from membership.user_id. Membership row identity is stable and tenant-scoped; use `UNIQUE(id,tenant_id)`. Assignment uses `FOREIGN KEY (membership_id,tenant_id)`.

Membership revocation changes status and preserves history. FK prevents cross-tenant identity mismatch; backend authorization checks active membership on every protected operation. If current membership data stores multiple historical rows, define a stable identity/current-membership contract before implementation.

## 5. G-04 — exact site-link reference

Assignment carries the exact site-link ID and redundant tuple columns for composite integrity. Site-link parent candidate key is `UNIQUE(id,tenant_id,transaction_id,participant_id,site_id)`. Assignment FK references all five columns. Existing CFK-001–004 remain required.

This prevents assigning a site that is owned by the tenant but not linked to the participant and transaction. A revoked/expired site link still exists for history; runtime authorization denies its dependent assignment. Do not delete or silently repoint historical links.

## 6. PostgreSQL and SQLite enforcement parity

| Concern | PostgreSQL | SQLite |
|---|---|---|
| Composite identity FKs | Native composite FK | Native composite FK + foreign_keys enabled on each connection |
| Buyer/Seller role uniqueness | Partial unique indexes | Same partial unique indexes; minimum version pinned |
| Binding verification/effective-time gate | Transactional approval validation + trigger/service | Transactional approval validation + trigger/service |
| Membership and site-link active status | Backend authorization at request time | Backend authorization at request time |
| Concurrent temporal binding overlap | Per-tenant serialized write/lock and trigger | Serialized SQLite write transaction + trigger |
| Cross-row party matching | Trigger or normalized relation + FK | Equivalent trigger or normalized relation + FK |

## 7. Review outcomes and remaining gates

These four gaps are resolved at logical design level, pending user review. They are not database-tested and do not authorize DDL.

After review, finalize the complete PostgreSQL–SQLite constraint matrix and then assess:
- DEC-006: RLS policy, non-bypass application role, tenant context and negative tests.
- DEC-007: actual SQLite runtime provenance, connection PRAGMAs and schema inventory.
- DEC-008: same positive/negative fixtures and concurrency cases on pinned PostgreSQL/SQLite versions.

Schema freeze remains NOT READY until those evidence gates and cross-platform/legacy reconciliation are closed.
