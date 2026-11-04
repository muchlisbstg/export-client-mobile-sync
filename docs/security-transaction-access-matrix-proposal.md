# Transaction access matrix proposal (SEC-03)

**Status: DRAFT — NOT APPROVED FOR PRODUCTION**

Baseline: `main` at `d7612f79661978d843808b3a25ef534f5e72cb0e`.

This proposal is a governance artifact, not an authorization change. Do not use it as an implementation contract until the product owner and security owner approve it.

## Proposed least-privilege policy

| Role | List transactions | Transaction detail | Commercial fields | Operational fields | Audit |
|---|---|---|---|---|---|
| enterprise_admin | All in active enterprise | All in active enterprise | Full, subject to legal purpose | Full | Read |
| buyer | Only assigned buyer-side transactions | Same scope | Buyer-relevant terms only | Milestones needed for buyer | No |
| seller | Only assigned seller-side transactions | Same scope | Seller-relevant terms only | Milestones needed for seller | No |
| supplier | No default access; explicit linked transaction scope only | Same scope | No pricing/contract terms by default | Supplier fulfilment scope only | No |
| warehouse | No default access; explicit fulfilment scope only | Same scope | No | Inventory, packing and dispatch fields only | No |
| qc | No default access; explicit lot/inspection scope only | Same scope | No | Quality, evidence and lot status only | No |
| logistics | No default access; explicit handover/shipment scope only | Same scope | No | Shipping, handover and delivery fields only | No |
| auditor | Read-only, approved audit scope | Same scope | Redacted unless explicitly authorized | Read-only | Read |

## Blocking data-model questions

The current single-enterprise model must prove how a user is linked to the buyer/seller/supplier/fulfilment side of an individual transaction. Enterprise membership alone is insufficient to implement row-level buyer/seller scope safely.

Before approval, define:
1. Transaction participant identifiers (user, organization unit, or explicit role assignment).
2. Which fields are commercially sensitive (price, margin, payment terms, bank instruments, counterparty contact data).
3. Whether auditor access is global or engagement-scoped, and whether sensitive fields are masked.
4. Whether operational roles see only assigned sites/lots/handover references.
5. Retention, export, and audit requirements.

## Acceptance criteria

- No blanket read permission for all enterprise roles.
- Every list and detail query is scoped server-side by enterprise and explicit transaction participation/operational assignment.
- Direct-object access cannot bypass list scope.
- Unauthorized requests return a consistent 403/404 without disclosing record existence.
- Tests cover each role against each data classification and cross-enterprise/cross-site object IDs.
- Product owner, security owner, and legal/compliance reviewer record approval before enforcement is enabled.

## Decision record

- Product owner: **Pending**
- Security owner: **Pending**
- Legal/compliance reviewer: **Pending**
- Approval date: **Pending**
