# GH-02-CROSS-REPOSITORY-PLATFORM-CONTRACT-INVENTORY-001

**Status:** READ-ONLY CROSS-REPOSITORY REVIEW — CRITICAL AUTHORITY / CONTRACT GAP
**Date:** 2026-11-10
**Coordination repository:** muchlisbstg/export-client-mobile-sync
**Coordination branch:** `review/p0-domain-schema-readonly-2026-11-10`
**Scope:** Web, Mobile and Desktop repository documentation, package manifests and selected API contracts.
**No implementation, test execution, workflow dispatch or deployment was performed.**

## 1. Repositories and evidence baseline

| Platform | Repository / branch | Pinned evidence | Source-level architecture |
|---|---|---|---|
| Web | `muchlisbstg/export-client-web-sync` / `main` | `package.json` SHA `9b16f2f2ddb14f6629d9e866b5d2c8520dd1254b`; `README.md` SHA `f59b0654cb71f5dcebdb23e3fd42cd233b311314`; `server/index.ts` SHA `0b58322906b79c7a9f318e01b9f77670daac28bb`; `docs/openapi.yaml` SHA `cf1853fc66519974581fe87c72a62a23e2ca19c0` | React/Vite + Express; local SQLite; optional inquiry peer replication |
| Mobile | `muchlisbstg/export-client-mobile-sync` / review branch | `package.json` SHA `bcfae9e438c701576b19b831fece71048c53f9a4`; `server/index.mjs` SHA `e22751d4c976935f8ab5bb29decb6f1043868a53`; `server/authorization.mjs` SHA `2996a3fe928d699c61ddbb13d0fec88f377ffa6f`; `src/api-core.ts` SHA `c6e00a6887e7721ae35653e83e3c67de832affce` | Expo/React Native + Express; local SQLite; legacy single-enterprise authorization source |
| Desktop | `muchlisbstg/export-client-desktop-sync` / `main` | `package.json` SHA `c73aaf127b468ce4b0e0eef2008872596905097b`; `README.md` SHA `33bfabd172b6e94ac9a17bd4c6267f2cf92bc6c2`; `docs/integration.md` SHA `2f38afc9e5c0d73371f7cc3e175fdaf1a601137d` | Electron + React + local Express/SQLite API |

## 2. Current inter-platform contract

The Web OpenAPI document identifies itself as **Export Client Peer API 2.0.0** for three independent backends. Its inquiry contract is:
- `GET /health`
- `GET /api/v1/products`
- `POST /api/v1/inquiries`
- `GET /api/v1/inquiries/{trackingCode}`
- `POST /api/v1/sync/inquiries` for service-to-service replication using a shared bearer secret.

The inquiry create payload contains customer name/email, destination country, product, and quantity. The documented replication model is append-only, eventual, peer-to-peer, with no master, update or delete. Tracking code is documented as a bearer secret. The contract does not define the canonical transaction participant, legal-party binding, membership, exact site-link, action-grant or multi-party lifecycle context required by DEC-001–005.

The Web README and Desktop integration guide explicitly describe separate local SQLite databases and peer replication. The Desktop README describes an Electron-local backend and says user login/admin authorization is not yet implemented. The Mobile source contains an enterprise login/session path but is bound to one configured enterprise in the inspected authorization middleware.

## 3. Evidence of authority mismatch

| Required target invariant | Current repository evidence | Disposition |
|---|---|---|
| PostgreSQL is authoritative shared transaction database | Web README, Desktop README/integration and Mobile API source describe independent local SQLite databases; Web package manifest includes `better-sqlite3`; Desktop package manifest includes `better-sqlite3`; Mobile package manifest includes `better-sqlite3` | **CRITICAL GAP** |
| Tenant context is independently resolved per active membership | Mobile authorization source requires one configured `singleEnterpriseId`; Web server has a tenant context path, but still reads local SQLite; Desktop integration docs do not define user authentication/membership | **CRITICAL GAP** |
| Buyer/Seller/Supplier are independent tenant participants | Existing OpenAPI inquiry payload and peer sync record are inquiry-centric and have no canonical participant relation | **CONTRACT GAP** |
| Operational authorization is transaction + exact site-link + action scoped | Mobile supply routes use local role/site-type and user/site assignments; cross-repo public OpenAPI does not express the canonical transaction/site/action tuple | **CRITICAL GAP** |
| Revocation and lifecycle are authoritative across offline clients | Existing peer sync replicates append-only inquiry records; it is not a canonical transaction command authorization protocol | **CRITICAL GAP** |
| Web/Mobile/Desktop share one canonical API | Existing public endpoints are compatible for inquiry/catalog/tracking; canonical transaction authorization contract is not represented | **PARTIAL COMPATIBILITY ONLY** |
| Desktop implementation exists | Desktop repo uses Electron and packages a local API | **PRESENT**, but authorization/authority parity is not proven |

## 4. Interoperability test boundary

Web `docs/interop-testing.md` (SHA `d9941cdea354e724f534d9bcd22e9b3ac2398799`) describes a local three-backend test using three synthetic inquiries, temporary SQLite databases and dynamically selected loopback ports. Its scenarios include replay, duplicate, conflict and tracking-code collision behavior.

This is useful evidence for the **existing inquiry peer-sync contract** only. It does not prove:
- PostgreSQL/SQLite schema parity;
- PostgreSQL RLS;
- canonical transaction participant or legal-party binding integrity;
- membership/site-link/action assignment enforcement;
- transaction lifecycle authorization;
- offline command revocation/replay safety under the approved domain model;
- actual deployed API process database provenance.

The runbook says CI workflows in all three repos run interoperability tests, but workflow YAML and actual run results were not fetched or executed in this review. Therefore no CI pass is claimed.

## 5. Reconciliation decisions required

1. **Authority model:** Decide the migration path from three local SQLite peer backends to one PostgreSQL-authoritative transaction API. Define whether peer sync remains only for offline/demo inquiry or is retired for canonical transactions.
2. **Identity and membership:** Define a shared authentication/session contract resolving user → active membership → tenant. A client-supplied tenant header is a selector, never proof of authority.
3. **Participant domain:** Define transaction participants for Buyer, Seller and Supplier, with canonical legal-party binding version and composite keys.
4. **Operational scope:** Replace role/site heuristics with exact transaction participant → active transaction-site-link → membership assignment → explicit action grant checks.
5. **Lifecycle and offline behavior:** Specify server-authoritative transitions, revocation, expiry, command idempotency, stale offline replay rejection and audit.
6. **Cross-platform contract:** Publish one versioned OpenAPI contract and generated/validated client types for Web, Mobile and Desktop.
7. **Desktop trust boundary:** Specify IPC, local cache, offline queue, credential handling and server authorization; local SQLite must not be treated as authority.
8. **Syariah/legal governance:** Keep akad, commercial approval, payment and ledger authority separate from operational Supplier/site permissions and subject to the approved legal/Syariah governance gates.

## 6. Required next evidence

- Fetch and inspect all three repositories' workflow YAML and exact CI runs for the existing interoperability suite.
- Inspect complete route and database implementations across Web, Mobile and Desktop, not only README claims.
- Build a route-by-route mapping from current inquiry APIs to canonical transaction APIs.
- Produce one canonical contract and per-platform negative-access matrix.
- Build DEC-006 PostgreSQL RLS tests and DEC-008 disposable PostgreSQL/SQLite parity harness only after the target schema and authorization contract are approved.
- Obtain actual-host DEC-007 provenance separately.

## 7. Disposition

- Three platform repositories are confirmed to exist.
- Existing inquiry peer-sync interoperability is documented, but its CI execution has not been verified in this review.
- The three repositories currently describe separate SQLite persistence; no shared PostgreSQL authority is evidenced by the reviewed artifacts.
- Web, Mobile and Desktop are **not reconciled** to the approved canonical multi-tenant transaction authorization contract.
- DEC-006: **OPEN**.
- DEC-007: **OPEN**.
- DEC-008: **OPEN**.
- Schema freeze: **NOT READY**.

No source code, workflows, databases, staging/production resources or deployment settings were modified. No test was run and no CI run was dispatched.
