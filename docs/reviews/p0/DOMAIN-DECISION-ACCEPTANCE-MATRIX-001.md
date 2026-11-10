# DOMAIN-DECISION-ACCEPTANCE-MATRIX-001

**Status:** ACCEPTANCE SPECIFICATION — NOT EXECUTED  
**Date:** 2026-11-10  
**Baseline:** DEC-001–DEC-005 approved; DEC-006–DEC-008 open  
**Mode:** Read-only review

## 1. Purpose

This matrix turns approved domain decisions and canonical relationship rules into reviewable acceptance criteria. "Expected" describes required behavior; it is not a test result. No test in this document is represented as executed.

## 2. Domain decision acceptance

| ID | Requirement | Expected result | Status |
|---|---|---|---|
| DOM-001 | Buyer, Seller and Supplier have independent tenant identities | Separate membership/admin/data boundaries | SPECIFIED |
| DOM-002 | Legal party is distinct from tenant | Contract identity never inferred from tenant ID | SPECIFIED |
| DOM-003 | One participant per tenant/transaction | Duplicate pair rejected | DEC-002 APPROVED |
| DOM-004 | Supplier participation explicit | No Supplier access before approval | DEC-005 APPROVED |
| DOM-005 | Supplier operational access is bounded | Exact participant + site + action + time required | DEC-003/005 APPROVED |
| DOM-006 | No broad scope from NULL site | NULL cannot grant transaction-wide access | DEC-003 APPROVED |
| DOM-007 | One party-tenant transaction scope source | `transaction_participants` is canonical | RECONCILED |
| DOM-008 | Supplier cannot approve contract/payment/release | Operation denied by domain policy | SPECIFIED |

## 3. Key and constraint acceptance

| ID | Constraint | Positive case | Negative case |
|---|---|---|---|
| KEY-001 | Participant PK `id` | Unique ID inserts | Duplicate ID rejected |
| KEY-002 | `UNIQUE(tenant_id, transaction_id)` | One tenant participates | Duplicate participant pair rejected |
| KEY-003 | `UNIQUE(id, tenant_id, transaction_id)` | Child tuple references exact participant | Mismatched tenant/transaction rejected |
| KEY-004 | Site candidate key `UNIQUE(tenant_id,id)` | Site owner tuple resolves | Cross-tenant site tuple rejected |
| KEY-005 | Assignment participant composite FK | Matching participant tuple accepted | Participant ID combined with other tenant/transaction rejected |
| KEY-006 | Site-link participant composite FK | Matching participant tuple accepted | Mismatched participant tuple rejected |
| KEY-007 | Assignment site composite FK | Same-tenant site accepted | Other-tenant site rejected |
| KEY-008 | Site-link site composite FK | Same-tenant site accepted | Other-tenant site rejected |
| KEY-009 | Assignment-to-site-link consistency | Site link for same participant/transaction accepted | Assignment uses unlinked site rejected |
| KEY-010 | Membership consistency | Assigned user belongs to participant tenant | Cross-tenant/non-member user rejected |
| KEY-011 | Buyer/Seller role cardinality | One Buyer and one Seller participant | Duplicate Buyer or Seller role rejected |
| KEY-012 | Legal binding temporal uniqueness | Adjacent non-overlapping periods accepted | Overlapping verified/effective periods rejected |
| KEY-013 | Participant/legal binding version | Participant references verified binding version | Mismatched tenant/legal-party binding rejected |
| KEY-014 | Effective periods | Valid positive period accepted | End <= start rejected |
| KEY-015 | Controlled vocabularies | Known active status/action accepted | Unknown/deprecated status/action rejected |

KEY-010–KEY-013 include schema-review refinements whose exact physical expression is not yet approved.

## 4. Authorization negative-access acceptance

| ID | Scenario | Expected |
|---|---|---|
| AUTH-001 | Tenant has no participant for transaction | DENY |
| AUTH-002 | Supplier participant pending | DENY |
| AUTH-003 | Supplier participant active, no site assignment | DENY |
| AUTH-004 | Assignment is for another user | DENY |
| AUTH-005 | Assignment action absent/deprecated | DENY |
| AUTH-006 | Participant suspended/revoked/expired | DENY |
| AUTH-007 | Membership revoked | DENY |
| AUTH-008 | Assignment/site link expired or revoked | DENY |
| AUTH-009 | Client forges tenant/participant/site/action | DENY |
| AUTH-010 | Supplier reads unrelated tenant resource | DENY without data leak |
| AUTH-011 | Supplier attempts contract approval | DENY |
| AUTH-012 | Supplier attempts payment approval/ledger mutation | DENY |
| AUTH-013 | Supplier attempts goods release | DENY |
| AUTH-014 | Stale offline command after server revocation | Server rejects replay |
| AUTH-015 | Valid participant, active site link, assignment and action | ALLOW within exact scope only |

## 5. PostgreSQL / SQLite parity corpus

| ID | Scenario | PostgreSQL | SQLite |
|---|---|---|---|
| PAR-001 | Duplicate tenant/transaction participant | Reject | Reject |
| PAR-002 | Assignment cross-tenant participant tuple | Reject | Reject |
| PAR-003 | Site link cross-tenant site tuple | Reject | Reject |
| PAR-004 | Invalid status/action vocabulary | Reject | Reject |
| PAR-005 | Invalid effective period | Reject | Reject |
| PAR-006 | Overlapping verified binding periods | Reject | Reject |
| PAR-007 | Participant/legal-party binding mismatch | Reject | Reject |
| PAR-008 | Assignment references site not linked to participant | Reject | Reject |
| PAR-009 | Revoked offline event replay | Server rejects | Server rejects |
| PAR-010 | Audit history mutation | Reject / controlled privileged path | Reject / controlled privileged path |

SQLite parity requires `PRAGMA foreign_keys = ON` on every connection and trigger/transaction enforcement for temporal overlap where no native equivalent exists.

## 6. Evidence requirements and execution status

| Gate | Evidence required | Current status |
|---|---|---|
| Domain DEC-001–005 | User approval record and decision register | APPROVED |
| Logical entity/key mapping | Reviewed mapping document and cross-document consistency | IN REVIEW |
| DEC-006 RLS | Policy matrix, non-bypass role, read/write policy tests | OPEN |
| DEC-007 SQLite provenance | Runtime DB path/version, PRAGMA FK, FK/index/check/trigger inventory | NOT VERIFIED |
| DEC-008 parity | Disposable DB fixtures, same corpus, exact SHA/schema version | NOT VERIFIED |
| Backend authorization | Route-level positive/negative tests and fail-closed evidence | NOT VERIFIED |
| Legacy data | Classification/quarantine and deterministic reconciliation | OPEN |
| Implementation readiness | All critical gates closed with source-pinned evidence | NOT READY |

## 7. Review sign-off checklist

- [ ] Domain authority and supersession matrix accepted.
- [ ] Participant relationship cardinalities accepted.
- [ ] Candidate key and composite FK mapping accepted.
- [ ] Buyer/Seller role uniqueness enforcement accepted.
- [ ] Binding-version reference decision accepted.
- [ ] Assignment-to-site-link integrity mechanism accepted.
- [ ] Membership-to-assignment integrity accepted.
- [ ] Open delegation, legal and role/action catalog decisions assigned.
- [ ] DEC-006, DEC-007 and DEC-008 closure evidence reviewed.
- [ ] Only after these items: consider schema freeze readiness.

## 8. Governance

This is a test specification, not a test report. No tests have been run by creating this document. It does not authorize DDL, migrations, source changes, shared/live tests, PR, merge or deployment.
