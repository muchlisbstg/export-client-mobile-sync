# P0 reconciliation — 8 November 2026

## Baseline and scope

- Base: `main` at `a4c91721d95a578607ef0610730721ed316aaa1b`.
- Source PRs: #119 (authorization hardening) and #118 (CORS contract, schema notes, delivery blueprint).
- This branch selectively reapplies missing authorization and CORS deltas; it does not merge either stale PR branch.
- No merge, deployment, migration, or staging/production database access is performed by this work.

## Authorization deltas selected from #119

- Remove the duplicate transaction list/detail route registrations so the assignment-aware route implementation is authoritative.
- Keep the client health panel aligned with the minimal `{ status: "ok" }` liveness response; do not expose peer topology, queue, retry, or conflict details.
- Align the API client health type with the minimal liveness contract.
- Expand the route-denial matrix to include seller, logistics, and auditor identities and exercise role-denial behavior across supply-chain and transaction mutation/read routes.
- Add evidence entity × role denial assertions.
- Add a source-only handover creation denial case when the caller is authorized at only one site.
- Add transaction assignment/site-link grant, cross-enterprise denial, and revocation assertions.
- Assert minimal health response and cache behavior.

These tests use synthetic identities and disposable SQLite fixtures. They are not a full Cartesian proof of every role × endpoint × enterprise × site state.

## CORS deltas selected from #118

- Exact configured-origin allowlist remains mandatory.
- Preflight permits only GET, POST, PATCH, and DELETE.
- Preflight permits only Authorization, Content-Type, Idempotency-Key, X-Active-Tenant-Id, and X-Request-Id.
- Unsupported methods and headers are rejected with 403.
- Preflight responses vary by Origin, requested method, and requested headers; max-age is 600 seconds.
- No credentialed cross-origin cookies are enabled.
- Regression tests include allowed methods, untrusted origin, unsupported method, and unapproved request header.

CORS is not authentication or authorization. Browser E2E remains an outstanding acceptance item.

## Separate schema-design review — not implemented here

Five source-level integrity blockers remain open:

1. Missing transaction-party bridge for buyer/seller party membership.
2. Missing composite tenant/transaction FK from transaction access assignments.
3. Missing composite tenant/site FK from transaction access assignments.
4. Missing composite tenant/transaction FK from transaction site links.
5. Missing composite tenant/site FK from transaction site links.

The proposed bridge requires a domain decision: whether the counterparty is represented as an external legal-party tenant, an internal enterprise role, or another governed entity. Security and Database reviewers must decide this before schema DDL is authored.

No SQLite or PostgreSQL migration, Supabase object, RLS change, backfill, or data mutation is included. PostgreSQL FK and RLS behavior must be tested independently using isolated fixtures before any staging migration is considered.

## Independent review and P0 disposition

- Independent Security Review is mandatory against the exact final branch SHA.
- Reviewer identity and approval are not assumed; repository owner must supply or appoint a reviewer independent of the implementation author.
- Reviewer must assess route inventory, least privilege, site/transaction scope, fail-closed audit behavior, revocation, CORS, and denied-write immutability.
- Database/schema review is a separate gate from application Security Review.
- P0 remains OPEN until fresh exact-SHA CI, browser-level CORS E2E, required positive/negative coverage, exhaustive relevant audit-failure checks, independent Security approval, and separate schema design approval are recorded.
