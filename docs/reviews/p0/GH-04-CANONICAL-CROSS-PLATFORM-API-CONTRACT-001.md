# GH-04-CANONICAL-CROSS-PLATFORM-API-CONTRACT-001

**Status:** PROPOSED RECONCILIATION CONTRACT — REVIEW REQUIRED
**Date:** 2026-11-10
**Repositories:** muchlisbstg/export-client-web-sync; muchlisbstg/export-client-mobile-sync; muchlisbstg/export-client-desktop-sync
**Authority:** Approved DEC-001–DEC-005 and accepted logical DEC-006 matrix.
**Boundary:** Contract design only; this document does not silently approve replacement of deployed APIs or authorize migration/deployment.

## 1. Reconciliation outcome

All three platform repositories currently expose or package local SQLite-backed services and inquiry peer synchronization. The approved target requires one PostgreSQL-authoritative shared transaction service. Existing inquiry/catalog endpoints may remain as a compatibility surface during transition, but they are not the canonical transaction authorization API.

**Target topology:** Web, Mobile and Desktop are clients. They authenticate through the approved identity provider and call one authoritative API service. PostgreSQL owns shared transaction state and final authorization. SQLite may cache/offline-queue provisional data only; local state never authorizes final transaction, payment, contract, custody or goods-release decisions.

## 2. Canonical identity and request context

The client may identify the requested resource and requested tenant context, but the server resolves authority from verified session and active records. Never trust a client-supplied role, participant status, membership status, site assignment, legal-party binding, or action grant.

Canonical server-resolved context:

| Field | Authority | Rule |
|---|---|---|
| user_id | Verified identity token | Never accept body user_id as authentication |
| tenant_id | Active membership lookup | Requested tenant is only a selector |
| membership_id | Stable active membership row | Must belong to user + tenant |
| transaction_id | Canonical transaction lookup | Must have eligible participant for tenant |
| participant_id | Participant tuple | Must match tenant + transaction |
| site_link_id | Active exact site-link | Must match tenant + transaction + participant + site |
| action_code | Canonical permission catalog | Must be explicitly granted and active |
| request_id/idempotency_key | Client-generated opaque identifier | Unique per tenant + operation scope; replay-safe |

The server re-resolves lifecycle and effective-time predicates on every protected operation. A stale offline snapshot cannot override revocation.

## 3. Canonical API surface (proposed version 1)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/session/context` | Return server-resolved memberships and permitted tenant selectors; no role-only authorization |
| GET | `/api/v1/transactions` | List transactions visible through eligible participants |
| POST | `/api/v1/transactions` | Create draft transaction with distinct Buyer/Seller legal parties |
| GET | `/api/v1/transactions/{transactionId}` | Read only if current tenant has eligible participant |
| POST | `/api/v1/transactions/{transactionId}/participants` | Invite/record Buyer, Seller or independent Supplier participant |
| POST | `/api/v1/transactions/{transactionId}/participants/{participantId}/approvals` | Record authenticated approval evidence |
| POST | `/api/v1/transactions/{transactionId}/site-links` | Create bounded participant-owned site link |
| POST | `/api/v1/transactions/{transactionId}/assignments` | Assign stable membership to exact site-link and explicit actions |
| POST | `/api/v1/transactions/{transactionId}/commands` | Execute versioned lifecycle command with idempotency key |
| GET | `/api/v1/transactions/{transactionId}/audit` | Read authorized append-only audit history |

The existing inquiry endpoints remain separate compatibility APIs until an explicit deprecation/migration decision is approved. Do not reinterpret an inquiry as a commercial transaction.

## 4. Canonical command envelope

```json
{
  "contract_version": "1",
  "request_id": "opaque-client-generated-id",
  "idempotency_key": "opaque-operation-key",
  "expected_version": 7,
  "command": "participant.activate",
  "resource": {
    "transaction_id": "uuid",
    "participant_id": "uuid",
    "site_link_id": "uuid"
  },
  "payload": {},
  "client_observed_at": "2026-11-10T00:00:00Z"
}
```

Server derives user, tenant, membership, legal party, participant eligibility, exact site scope, action grant and authoritative time. `client_observed_at` is telemetry only and never an authorization or ordering authority. The server persists an idempotency result keyed by authenticated tenant and operation scope. A repeated key with the same canonical payload returns the original result; a key reused with a different payload is rejected.

## 5. Canonical response and error semantics

- Success returns resource ID, canonical version, authoritative server timestamp, lifecycle state and request correlation ID.
- 401: missing/invalid identity.
- 403: identity valid but membership/participant/site/action policy denies.
- 404: resource not visible to current tenant (avoid existence disclosure).
- 409: version conflict, duplicate idempotency key with different payload, or invalid lifecycle transition.
- 422: structurally invalid domain command.
- 429: bounded retry/backoff.
- 5xx: no client assumption that the command committed; retry only with the same idempotency key.

Error payload should contain stable `code`, `request_id`, safe `message`, and optional field-level validation details. Never expose SQL, tenant-existence hints, secrets or internal stack traces.

## 6. Platform adapter contract

| Concern | Web | Mobile | Desktop |
|---|---|---|---|
| Identity | Shared OIDC/Supabase-authenticated token | Same issuer and claims | Same issuer and claims |
| Tenant selector | Request header/path selector, server-validated | Same | Same |
| Authorization | Server only; UI guards are UX | Server only; offline cache is not authority | Server only; local DB/IPC is not authority |
| Offline | No final transaction authority | Queue signed/identified command intent; revalidate online | Same; local cache/queue only |
| Idempotency | Required for mutating commands | Required; persist across retries | Required; persist across retries |
| Revocation | Re-fetch/deny | Revalidate before replay; purge/mark denied | Revalidate before replay; purge/mark denied |
| Local storage | Cache only | SQLite cache/outbox only | SQLite cache/outbox only |
| Audit | Server-generated immutable event | Same | Same |

Desktop must enforce a narrow IPC boundary. Renderer-supplied user/tenant/role claims are untrusted. Local API must not expose a path to bypass the authoritative service.

## 7. Domain invariants all clients must preserve

1. Legal party is not tenant; Buyer, Seller and Supplier are independent tenants.
2. One tenant has at most one currently effective verified legal-party binding; history is versioned and retained.
3. One participant per (tenant_id, transaction_id); multiple independent Supplier tenants may participate.
4. Buyer and Seller legal parties and tenants are distinct; exactly one of each is required before commercial activation.
5. Participant pins the exact legal-party binding version used at approval.
6. Site access requires exact transaction-site-link + stable tenant membership assignment + explicit action grant.
7. Pending, suspended, revoked, expired or ineffective participant/assignment denies operational access.
8. Supplier never receives contract approval, payment/ledger, or goods-release authority from operational participation.
9. Bilateral Buyer/Seller approval and independent Supplier participation approval govern activation/reactivation.
10. PostgreSQL is authoritative; SQLite is offline/local only.
11. Server revalidates revocation, lifecycle, effective period, action and idempotency at commit time.
12. Audit is append-only to ordinary application roles.

## 8. Contract reconciliation matrix

| Existing capability | Transition disposition | Required evidence |
|---|---|---|
| Web/Mobile/Desktop inquiry and catalog | Compatibility surface; not canonical transaction | Existing interop tests remain separate |
| Three local SQLite databases | Local cache/offline only for target transactions | Migration plan and authority boundary review |
| Inquiry peer-to-peer replication | Must not replicate authoritative transaction decisions | Explicit scope restriction and negative tests |
| Mobile singleEnterpriseId authorization | Superseded by approved multi-tenant model | Route-level migration matrix; no silent fallback |
| Mobile site/user role checks | UX/context hints only; replace as authority with canonical tuple | Backend negative tests |
| Desktop unauthenticated local API | Not acceptable for shared protected operations | Authentication + IPC + server contract |
| Web tenant header/context | Selector only; not proof of access | Server membership resolution and RLS |

## 9. Blocking decisions / unresolved design

- Exact identity issuer, token audience and server-side tenant selection mechanism.
- Whether existing inquiry peer replication remains permanently supported for non-transaction use.
- Canonical transaction lifecycle transition graph and command catalogue.
- Approval-evidence schema and legal/Syariah workflow boundaries.
- Offline command signature, expiry, device identity and replay semantics.
- Desktop local API/IPC hardening and credential storage.
- Compatibility and migration/deprecation sequence across all three repositories.

These items must be resolved in review before implementation rollout. They cannot be guessed from current source.

## 10. Acceptance criteria

- One versioned OpenAPI contract is generated/validated for all three clients.
- All client requests use the same command envelope and idempotency semantics.
- Server resolves identity → membership → tenant → participant → site-link → assignment → action.
- Client-supplied scope/role/status cannot elevate access.
- Revocation and expiry are checked at command execution and offline replay.
- Supplier authority exclusions are tested.
- Existing inquiry interoperability remains independently tested.
- PostgreSQL RLS tests run with non-bypass API role.
- SQLite parity tests cover local constraints but never claim RLS equivalence.
- Cross-platform contract tests prove equivalent allow/deny outcomes.

**Disposition:** proposed canonical contract for review; cross-platform reconciliation remains OPEN until route-by-route implementation and negative-test evidence are attached.
