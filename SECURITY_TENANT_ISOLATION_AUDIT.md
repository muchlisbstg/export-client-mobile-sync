# Enterprise authorization and tenant-scope security audit

**Review date:** 3 November 2026  
**Repository:** `muchlisbstg/export-client-mobile-sync`  
**Reviewed main SHA:** `d4a267489986a4f4e2aab2c2e4a4ae3ddd24456e`

## Executive assessment

The current product direction is **single-enterprise**, not a multi-enterprise Buyer/Seller marketplace. The repository contains server-side Supabase identity verification, configured enterprise membership resolution, role assignment checks, and scoped supply-chain route middleware.

**Assessment: PARTIALLY IMPLEMENTED — NOT A PRODUCTION SECURITY CERTIFICATION.**

The presence of authorization modules and passing CI does not prove every route, query, attachment, export, or external supplier workflow is completely protected. The public RFQ/tracking surface and health endpoint also require an explicit exposure review.

## 1. Verified implementation in source

### Identity and administrator access

- `server/auth.mjs` verifies a bearer token by requesting the Supabase Auth `/auth/v1/user` endpoint.
- Missing provider configuration fails closed with HTTP 503; missing or invalid/expired bearer tokens are rejected.
- A verified provider user ID is placed in server-side request context.
- Administrator access is currently derived from the server-side `ADMIN_USER_IDS` allowlist, not from client-editable role metadata.
- Provider/network failures fail closed with HTTP 503.

### Single-enterprise membership and role authorization

- `server/authorization.mjs` requires a configured `singleEnterpriseId` and the expected tenant/membership/role schema.
- Membership must be active in the configured enterprise.
- Active role assignments are loaded server-side and filtered against the recognized role set.
- A supplied `x-active-tenant-id` that differs from the configured enterprise is rejected; it cannot select another enterprise.
- Missing schema/configuration, missing identity, inactive membership, or missing recognized role fails closed.
- `server/index.mjs` registers the authorization middleware with the supply-chain route module.
- Supply-chain routes compose authentication, active-enterprise membership, role authorization, and site/assignment checks for the relevant operations.

### Route inventory observed

| Route family | Observed behavior | Security boundary / remaining concern |
|---|---|---|
| `GET /api/v1/auth/session` | Authenticated | Supabase identity verification |
| `GET /api/v1/enterprise/session` | Authenticated | Configured enterprise and schema readiness checks |
| `GET /api/v1/admin/session` | Authenticated and admin-only | Server-side admin allowlist |
| `GET /api/v1/transactions` and detail | Authenticated, active enterprise, recognized role | Enterprise-scoped query; verify all related object/document access paths |
| `POST /api/v1/transactions` and status PATCH | Return HTTP 410 | Single-enterprise order workflow is not implemented |
| `/api/v1/supply/*` | Uses shared auth + active-enterprise middleware and route-specific role/site checks | Continue endpoint/query-path and negative-test review |
| `GET /api/v1/products` | Public read | Confirm only intended public catalog fields are exposed |
| `POST /api/v1/inquiries` | Public RFQ creation with rate limiter | Validate abuse protection, consent, retention, and data minimization |
| `GET /api/v1/inquiries/:trackingCode` | Public tracking with format validation and rate limiter | Tracking code is a bearer capability; keep response minimal and prevent enumeration |
| `POST /api/v1/sync/inquiries` | Shared-secret protected; disabled if secret is absent | Service-to-service authentication only; validate peer identity, replay, idempotency, and network TLS |
| `GET /health` | Public | Current response includes operational node/sync/queue/conflict metadata; review and minimize public disclosure |

The retired multi-enterprise tenant-sync endpoint returns HTTP 410. This is consistent with the single-enterprise direction.

## 2. Compatibility schema — do not simplify prematurely

The code still uses `tenants`, `tenant_memberships`, `enterprise_role_assignments`, and legacy buyer/seller tenant references as part of its current authorization and transaction compatibility model.

- Treat the configured enterprise as the single owner context.
- Do not infer that Buyer and Seller are separate enterprise tenants.
- Do not remove compatibility tables/columns until all route, migration, sync, and test dependencies have been mapped.
- Do not assign legacy records to an enterprise based on email, node ID, tracking code, or names.
- Any future schema simplification requires a separate reviewed migration, verified backup, schema-only reconciliation, synthetic staging test, and rollback rehearsal.

## 3. Outstanding security gaps and review items

### P0 — Route and query completeness

- Complete a route-by-route inventory against the exact release SHA.
- Confirm every private query is scoped by configured enterprise and, where applicable, site assignment and object relationship.
- Review evidence/document retrieval, download, update, and deletion paths for object-level authorization.
- Verify every admin operation is behind server-side administrator authorization.
- Test role changes, membership suspension/revocation, and site assignment revocation immediately affect access.

### P0 — Public endpoint exposure

- Review the public `/health` response. It currently exposes node identity and sync/queue/conflict counters; return only minimal liveness information publicly or restrict detailed diagnostics to operator access.
- Review public inquiry creation for schema validation, abuse controls, consent/privacy notice, retention, and rate limiting behind the actual proxy.
- Keep tracking responses minimal, use `Cache-Control: no-store`, and test high-volume enumeration resistance.

### P1 — Peer sync and operational controls

- Require HTTPS/TLS for non-loopback sync traffic.
- Validate peer identity and payload ownership; a shared secret alone does not establish user membership.
- Test secret rotation/revocation, replay, duplicate delivery, retries, peer outages, and restart recovery.
- Ensure untrusted forwarded headers cannot bypass IP-based rate limits.
- Redact tokens, customer data, and secrets from logs and diagnostics.

### P1 — Privacy and data lifecycle

- Define purpose limitation, retention, correction, deletion, export, and incident response for customer and commercial data.
- Review backups, logs, crash reports, attachments, and device-local storage for personal or confidential business information.
- Document encryption, key management, least-privilege access, and backup/restore drills.

## 4. Required security tests

- Missing, malformed, expired, invalid, and provider-unavailable identity cases fail closed.
- Non-admin users cannot call admin routes.
- Missing/inactive enterprise membership or role is denied.
- Spoofed enterprise ID or client role cannot grant access.
- Buyer/Seller role boundaries are enforced for routes where their actions differ.
- Site assignment and object-level access are enforced.
- Cross-enterprise/unauthorized object IDs cannot disclose or mutate records.
- Public tracking cannot enumerate records or expose unrelated personal data.
- Sync without a valid secret is rejected; replay, duplicate, and invalid peer cases are covered.
- Health endpoint disclosure is tested against the approved public response contract.
- Backup/restore and legacy unassigned-record protections are tested with synthetic data.

## 5. Evidence and release decision

Repository test files include authentication, authorization, tenant migration, enterprise bootstrap, server, and supply-chain suites. The reviewed main SHA has successful Mobile CI, Android Preview, and iOS Simulator Build workflows. These are useful engineering signals, but they do not replace a complete security review or live staging acceptance.

**Release status: NOT CLEARED FOR REAL CUSTOMER/PRODUCTION DATA.**

Release requires closure of P0 route/query and public-health exposure reviews, negative integration tests on the exact candidate SHA, staging validation with synthetic fixtures, backup/restore evidence, privacy/legal review, and explicit human approval. No production migration, deployment, merge, or data export is authorized by this audit.
