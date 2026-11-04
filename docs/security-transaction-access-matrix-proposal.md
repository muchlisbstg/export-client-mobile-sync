# Transaction access matrix — SEC-03

**Status: APPROVED POLICY BASELINE — IMPLEMENTATION IN REVIEW; NOT APPROVED FOR PRODUCTION**

Baseline policy approval was given by the product owner in the conversation on 2026-11-04. This document does not authorize merge, deployment, production data migration, or production activation.

## Verified schema mapping

| Concern | Current schema | Implementation status |
|---|---|---|
| Enterprise identity | `tenants` | Existing |
| Enterprise membership | `tenant_memberships` | Existing |
| Enterprise role grant | `enterprise_role_assignments` | Existing |
| Buyer/seller transaction parties | `commercial_transactions.buyer_tenant_id`, `seller_tenant_id` | Tenant-level only; not a user assignment |
| Explicit transaction user access | `transaction_access_assignments` | Added by SEC-03 migration |
| Transaction-to-site relationship | `transaction_site_links` | Added by SEC-03 migration |
| User-to-site relationship | `supply_site_assignments` | Existing |
| Append-only access audit | `supply_audit_events` | Existing; reused for reads, denials and assignment changes |

Legacy inquiry ownership remains `unassigned` unless explicitly reconciled. No buyer/seller relationship is inferred from legacy inquiry fields.

## Role policy

| Role | Row scope | Field projection |
|---|---|---|
| enterprise_admin | All transactions where active enterprise is a buyer or seller party | Transaction IDs, party tenant IDs, inquiry reference, status and creation time |
| buyer | Explicit active transaction assignment | Same safe transaction projection; no unimplemented pricing/payment fields |
| seller | Explicit active transaction assignment | Same safe transaction projection; no unimplemented pricing/payment fields |
| supplier | Explicit transaction assignment + linked fulfilment site + active user-site assignment | ID, status, creation time |
| warehouse | Explicit transaction assignment + linked warehouse site + active user-site assignment | ID, status, creation time |
| qc | Explicit transaction assignment + linked QC site + active user-site assignment | ID, status, creation time |
| logistics | Explicit transaction assignment + linked logistics site + active user-site assignment | ID, status, creation time |
| auditor | Explicit transaction assignment; read-only | ID, status, creation time |

Supplier/Warehouse/QC/Logistics site links require matching purpose values. A role grant alone does not grant transaction access. Direct-object reads apply the same checks as list reads.

## Field classification

| Class | Examples | Policy |
|---|---|---|
| Transaction metadata | ID, status, creation time | Role-scoped |
| Party relationship | Buyer/seller tenant IDs, inquiry reference | Admin/Buyer/Seller only |
| Commercial | Unit price, total price, margin, discount | Buyer/Seller only by contract and explicit assignment; not currently present in this table |
| Payment / banking | D/P, D/A, LC, bank guarantee, account data | Deny by default; require legal, bank and Shariah approval before schema/API exposure |
| Operational | Site, lot, packing, dispatch, shipment | Explicit transaction-site link and user-site assignment |
| Audit | Actor, action, time, outcome | Auditor only within approved scope; admin under governance controls |

No pricing, payment, bank, or contract-detail columns were found in the current `commercial_transactions` schema. Do not infer they exist or expose them through a generic serializer.

## Assignment management

- Enterprise admin creates a transaction-site link using `POST /api/v1/transactions/:id/site-links`.
- Enterprise admin grants a role assignment using `POST /api/v1/transactions/:id/access-assignments`.
- Enterprise admin revokes a role assignment using `DELETE /api/v1/transactions/:id/access-assignments/:userId/:role`.
- User must already have the corresponding active enterprise role grant.
- Operational roles require a site link with matching purpose and an active `supply_site_assignments` record.
- Buyer, Seller and Auditor assignments are transaction-level and must not include a site ID.

## Audit and fail-closed requirements

Transaction reads, denied direct-object reads, assignment grants/revocations and site-link changes are written to append-only `supply_audit_events`. If audit persistence fails, the API returns 503 rather than silently completing the read or mutation. Audit event details must not contain secrets, payment credentials or unnecessary personal data.

## Acceptance gates

- [ ] Migration tested against fresh and existing staging schema.
- [ ] Negative integration tests cover missing assignment, wrong role, wrong site, revoked site assignment, direct-object ID guessing and cross-enterprise IDs.
- [ ] Positive tests cover each authorized role and its exact projection.
- [ ] Audit unavailable path returns 503.
- [ ] CI green on the final PR head.
- [ ] Product/security/legal review recorded before production activation.
- [ ] Payment and banking data remain unavailable until legal/bank/Shariah approval.

**Production status:** Not enabled. No production data was exported or modified.
