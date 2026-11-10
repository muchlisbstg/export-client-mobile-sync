# DOMAIN-AUTHORITY-AND-SUPERSESSION-MATRIX-001

**Status:** REVIEW BASELINE — DOMAIN DECISIONS DEC-001–DEC-005 APPROVED  
**Date:** 2026-11-10  
**Target:** Mobile repository  
**Mode:** Read-only documentation package; no implementation authorization

## 1. Purpose

This matrix establishes precedence between approved domain decisions, prior Mobile documents, and the canonical PostgreSQL–SQLite specification. It prevents a recommended ADR or legacy single-enterprise implementation from silently overriding the approved multi-tenant model.

## 2. Authority order

1. Explicit user-approved domain decisions DEC-001–DEC-005 recorded on 2026-11-10.
2. Approved Supplier hybrid / multi-tenant reconciliation recorded in Web review package branch `docs/integrated-review-package-p0`.
3. Canonical logical schema specification, only to the extent consistent with decisions 1–2.
4. Cross-platform/mobile architecture documents, as design input and evidence.
5. Proposed/recommended ADRs and current source implementation, which are not domain approval.

A source implementation is evidence of current behavior, not authority to redefine the domain.

## 3. Decision and supersession matrix

| Topic | Approved baseline | Conflicting / older proposal | Disposition |
|---|---|---|---|
| Operating model | Independent Buyer, Seller and Supplier tenants | Single operating enterprise in Mobile ADR P0-001 | NOT ADOPTED; approved multi-tenant baseline prevails |
| Contract identity | Legal party is distinct from tenant | Tenant ID used as contractual party proxy | REJECT; contract references legal parties |
| Tenant identity | Independent tenant boundary, membership and administration for each party | Supplier as internal role in Buyer/Seller tenant | REJECT |
| Transaction access anchor | `transaction_participants` | `transaction_tenant_scopes` as competing party-scope table | REPLACE for Buyer/Seller/Supplier party tenants |
| Supplier access | Independent Supplier tenant + active participant + bounded site/action/time assignment | Broad supplier role or generic external access | REJECT |
| Transaction-wide access | Explicit bounded exception | NULL site means enterprise-wide access | REJECT |
| Contract authority | Contract lifecycle and authorized representatives govern | Operational assignment implies contract authority | REJECT |
| Payment authority | Separate payment policy and authority | Supplier operational role implies payment approval | REJECT |
| Goods release | Separate custody/release gate | Supplier site assignment implies release authority | REJECT |

## 4. Approved DEC authority

| DEC | Normative decision | Status |
|---|---|---|
| DEC-001 | At most one verified/effective tenant–legal-party binding per tenant at any instant; retain versioned history, verification evidence and verifier attribution | APPROVED |
| DEC-002 | At most one participant per `(tenant_id, transaction_id)`; multiple user assignments/site links allowed; multiple Supplier tenants may participate | APPROVED |
| DEC-003 | Operational access is site-scoped; transaction-wide access is an explicit bounded exception; NULL site is never unrestricted | APPROVED |
| DEC-004 | Shared normalized action catalog; assignments reference canonical actions; deprecated actions cannot be newly granted | APPROVED |
| DEC-005 | Bilateral Buyer/Seller scope activation/reactivation; explicit Supplier participation approval and bounded scope; protective unilateral suspension remains permitted | APPROVED |
| DEC-006 | PostgreSQL RLS design, role model and negative tests | DESIGN REQUIRED |
| DEC-007 | Actual SQLite runtime schema provenance | NOT VERIFIED |
| DEC-008 | PostgreSQL/SQLite physical parity evidence | NOT VERIFIED |

## 5. Mobile source conflict inventory

The following are source-state findings, not approvals:

- `docs/adr/ADR-P0-001-transaction-party-composite-integrity.md` recommends a single operating enterprise and `transaction_tenant_scopes`. Its recommendation conflicts with DEC-001–DEC-005 and is not adopted for the approved product baseline.
- `docs/BUYER_SELLER_TENANT_ISOLATION.md` is titled and framed as a single-enterprise authorization contract. It must be revised only after separate approval; this package does not modify it.
- `server/authorization.mjs` contains `singleEnterpriseId` / active-enterprise assumptions. That is implementation evidence of a mismatch, not a reason to reverse the domain decision.
- `docs/architecture/AUTH-MOBILE-RECONCILIATION-001.md` on branch `docs/p0-mobile-auth-reconciliation` describes a multi-tenant participant model, but its older exactly-one Buyer/Seller participant phrasing must be reconciled with the approved Supplier cardinality and participant contract.

## 6. Canonical authority boundaries

- `legal_parties`: contractual legal identity.
- `tenants`: independent identity, membership, administration and data-isolation boundary.
- `tenant_legal_party_bindings`: verified, versioned association; not a login or transaction authorization grant.
- `commercial_transactions`: Buyer/Seller contractual legal-party references.
- `transaction_participants`: sole canonical party-tenant-to-transaction relationship.
- `transaction_site_links`: approved participant/site relationship.
- `transaction_access_assignments`: subject-specific operational access, bounded by participant, site, action and time.
- `permission_actions`: controlled action vocabulary.
- Backend authorization and applicable contract, payment, custody, legal and Syariah policy remain authoritative at operation time.

## 7. Open decisions / non-domain gates

1. Exact non-party delegated service-provider grant model (D-03) must be separately designed; do not reintroduce `transaction_tenant_scopes` as a party scope source.
2. Canonical role/action allowlist and role-to-action composition (D-05) needs a controlled catalog and approval.
3. Legal jurisdiction, registration identifiers, retention and evidence requirements (D-06) require legal/compliance review.
4. Exact physical candidate keys, triggers/exclusion constraints and index set require schema review; proposals are not frozen.
5. RLS policy design and non-bypass role evidence (DEC-006) remain open.
6. SQLite runtime provenance (DEC-007) and physical parity (DEC-008) remain unverified.
7. Existing legacy records and single-enterprise code paths need evidence-based reconciliation before implementation planning.

## 8. Governance

This document records authority and supersession only. It does not authorize source-code edits, DDL, migrations, database execution, shared/live tests, PR creation, merge, deployment, or staging/production mutation.
