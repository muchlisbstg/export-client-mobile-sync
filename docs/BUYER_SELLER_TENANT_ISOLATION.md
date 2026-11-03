# Single-enterprise authorization and Buyer/Seller role contract

**Review date:** 3 November 2026  
**Status:** implementation contract aligned to the current single-enterprise product direction; not a production security certification.

## 1. Approved product model

The product is operated by **one enterprise owner**. It is not a marketplace in which Buyer and Seller represent separate customer-owned enterprise tenants.

- The configured enterprise is the single organizational security boundary.
- Internal users receive one or more server-assigned roles, including `enterprise_admin`, `buyer`, `seller`, `warehouse`, `qc`, `logistics`, and `auditor`.
- `supplier` is also a recognized role. External supplier onboarding, invitation, and fine-grained external access must be treated as a separate capability and must not be assumed complete merely because the role exists.
- Buyer and Seller describe business functions within the enterprise. They do not create independent enterprise contexts.
- Access may additionally be scoped by site assignment, object ownership, and the transaction relationship.
- Client-supplied role or enterprise identifiers never establish authorization.

## 2. Current implementation shape observed in source

At reviewed main SHA `d4a267489986a4f4e2aab2c2e4a4ae3ddd24456e`:

- `server/authorization.mjs` resolves a user against the configured `singleEnterpriseId`, active `tenants` and `tenant_memberships`, then loads active `enterprise_role_assignments`.
- `x-active-tenant-id`, if supplied, must match the configured enterprise; it cannot be used to switch to another enterprise.
- The authorization middleware fails closed if the tenant schema is not ready, the enterprise is not configured, the identity is missing, membership is inactive, or no recognized active role exists.
- `server/index.mjs` passes the authorization middleware to the supply-chain route registrar.
- Supply-chain routes use authentication, active-enterprise membership, role checks, and site/assignment scope checks.
- Transaction list/detail endpoints are authenticated and enterprise-scoped. Legacy transaction creation and status mutation currently return HTTP 410 with `single_enterprise_order_workflow_not_implemented`.
- Legacy `buyer_tenant_id` and `seller_tenant_id` columns remain part of the compatibility model. Their presence must not be interpreted as approval for a two-enterprise marketplace.

This is evidence of code paths and middleware registration, not proof that every API route or every business object has complete authorization coverage.

## 3. Migration and legacy-record safety

- Do not delete tenant tables, membership records, role assignments, or legacy buyer/seller references as a documentation cleanup.
- Do not infer ownership from email, node ID, tracking code, display name, or other user-controlled values.
- Legacy/unassigned records must remain inaccessible through protected enterprise routes until an authorized owner resolves their ownership through an audited process.
- Any future schema simplification must be a separate migration proposal with a verified backup, schema reconciliation, deterministic rollback plan, and synthetic staging rehearsal.
- No production DDL, data rewrite, backfill, or operational data export is authorized by this document.

## 4. Authorization contract

1. Verify the bearer token server-side and derive the immutable provider user ID.
2. Resolve the user's active membership in the configured enterprise from server-side data.
3. Resolve active roles from server-controlled role assignments; never trust client role metadata.
4. Enforce role permissions on every protected read and write route.
5. Enforce site assignment and object/transaction scope in addition to broad role checks where applicable.
6. Scope list, detail, search, count, update, delete, export, attachment, and evidence queries to the configured enterprise and authorized site/object.
7. Keep public RFQ submission and tracking as explicitly separate flows with minimal response fields, rate limits, and anti-enumeration controls.
8. Keep peer synchronization server-to-server. A sync secret is not an end-user identity or enterprise membership.
9. Keep administrator privileges least-privilege and auditable.
10. Do not expose secrets, service-role credentials, or privileged API keys in mobile/web/desktop bundles.

## 5. Required integration and negative tests

- Active enterprise member with an allowed role can perform the intended operation.
- Missing, malformed, expired, or invalid identity token is rejected.
- Missing enterprise configuration or incomplete schema fails closed.
- Inactive enterprise membership and inactive role assignment are rejected.
- A client-supplied different enterprise ID cannot switch context.
- A user without the required role cannot perform the operation.
- Buyer cannot invoke seller-only actions and vice versa where the workflow defines distinct permissions.
- A user cannot access a site without the required assignment.
- Changing a transaction, lot, site, evidence, or handover ID cannot reveal another unauthorized object.
- Supplier access is limited to explicitly assigned objects and sites; no implicit broad access.
- Legacy/unassigned records remain inaccessible through protected routes.
- Missing/invalid sync credentials, replay, duplicate, and cross-enterprise legacy sync attempts fail closed.
- Migration is idempotent and preserves legacy records; backup/restore rehearsal passes on synthetic staging data.

## 6. Product workflow boundary

The following are product requirements, not claims of complete implementation:

- Buyer: catalog discovery, RFQ, quotation review, procurement approval, order visibility, receipt confirmation, and discrepancy handling.
- Seller: internal supply/fulfilment operations, quotation preparation where enabled, lot allocation, packing, QC coordination, and dispatch.
- Supplier: only explicitly approved RFQ/order/site/document access; onboarding and external identity lifecycle require separate acceptance criteria.
- Material commercial terms, contract/akad approval, payment settlement, refund, dispute, and compliance exceptions require authorized human decisions.

## 7. Release gate

Do not represent the application as fully tenant-isolated or production-ready based solely on the presence of these tables or middleware. Require route inventory review, query-path review, positive and negative integration tests, backup/restore evidence, green CI on the exact candidate SHA, and explicit human approval. No automatic merge or deployment.
