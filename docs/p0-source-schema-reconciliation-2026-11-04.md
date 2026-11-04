# P0 Source Schema Reconciliation — 2026-11-04

**Repository:** `muchlisbstg/export-client-mobile-sync`  
**Baseline:** `73e75edad71c5a6f8819e80c5ffdeabf32314c3d`  
**Scope:** static reconciliation of schema-producing source code and migration contracts only.  
**Status:** source inventory prepared; physical runtime schema and live database identity remain unverified.

## Evidence sources

| Source | Responsibility |
|---|---|
| `server/index.mjs` | Creates core `products`, `inquiries`, `sync_conflicts`, and `sync_outbox`; adds `products.active` when absent; adds default catalogue rows |
| `scripts/migrate-tenant-isolation.mjs` | Creates enterprise, membership, role, transaction, assignment, audit, and tenant sync structures; adds inquiry enterprise columns; invokes supply-chain migration |
| `server/supply-chain.mjs` | Creates site, lot, genealogy, inventory, inspection, handover, evidence tables and integrity triggers |
| `scripts/migrate-supply-chain.mjs` | CLI wrapper around tenant + supply-chain migration; enables SQLite foreign keys |
| `scripts/inspect-transaction-authorization-schema.mjs` | Read-only inspector for transaction-party and tenant/site composite-FK contract |
| `test/schema-reconciliation-contract.test.mjs` | Synthetic in-memory proof that inspector does not mutate schema and currently reports five blockers |

## Source-derived table inventory

### Core API schema — `server/index.mjs`

| Table | Key relationships / controls |
|---|---|
| `products` | Primary key `id`; active flag; catalogue seed rows are inserted idempotently |
| `inquiries` | Product reference; unique tracking code; quantity check; later enterprise columns are additive |
| `sync_conflicts` | Records conflict hashes/reason and peer identity; no business-row payload required for conflict comparison |
| `sync_outbox` | Composite key `(inquiry_id, peer_node_id)`; inquiry FK with cascade; retry metadata |

### Enterprise and transaction schema — `scripts/migrate-tenant-isolation.mjs`

| Table | Key relationships / controls |
|---|---|
| `tenants` | Buyer/seller tenant type; active/suspended/archived status |
| `tenant_memberships` | Composite PK `(tenant_id,user_id)`; tenant FK; constrained legacy membership role/status |
| `enterprise_role_assignments` | Composite PK `(enterprise_id,user_id,role)`; constrained eight-role vocabulary and status |
| `enterprise_role_audit` | Append-only role grant/revoke/suspend history; tenant FK |
| `supply_site_assignments` | Composite PK `(tenant_id,user_id,site_id)`; composite FK to `supply_sites(tenant_id,id)` |
| `supply_audit_events` | Append-only outcome/action record; tenant FK and timestamp index |
| `commercial_transactions` | Buyer and seller tenant FKs; buyer and seller must differ; constrained lifecycle status |
| `transaction_access_assignments` | PK spans tenant, transaction, user, role; current schema has independent tenant and transaction FKs, not a composite party FK; `site_id` is not FK-constrained |
| `transaction_site_links` | PK spans tenant, transaction, site, purpose; current schema has independent tenant and transaction FKs, not composite party/site FKs |
| `tenant_sync_outbox` | Unique event/peer identity, ordered queue sequence, JSON payload check, retry/delivery metadata |

The migration also adds `buyer_tenant_id`, `seller_tenant_id`, and `tenant_migration_state` to `inquiries`. Legacy rows remain `unassigned`; no ownership inference or backfill is authorized by this workstream.

### Supply-chain schema — `server/supply-chain.mjs`

| Table | Key relationships / controls |
|---|---|
| `supply_sites` | Tenant FK; unique `(tenant_id,id)` and `(tenant_id,site_code)`; active/site-type checks |
| `supply_lots` | Tenant FK; composite origin-site FK; tenant-scoped lot code; constrained status/unit |
| `lot_genealogy` | Composite parent/child lot FKs; parent differs from child; positive input/output quantity checks |
| `inventory_movements` | Tenant-scoped idempotency key; movement/status vocabulary; immutable posted movement controls |
| `processing_losses` | Composite movement and parent-lot FKs; positive quantity |
| `inventory_entries` | Composite movement/lot/site FKs; non-zero quantity delta; append-only and posting guards |
| `quality_inspections` | Composite lot/site FKs; inspection type/result constraints |
| `handovers` | Composite lot/from-site/to-site FKs; unique tenant handover/idempotency keys; positive quantity; source and destination differ |
| `supply_evidence` | Tenant FK and entity/evidence metadata; entity relationship is validated by service logic, not a polymorphic FK |

## Relationship map

- `tenants` → memberships, enterprise roles, commercial transaction parties, supply sites, audit events, tenant sync outbox.
- `commercial_transactions` → buyer tenant + seller tenant; transaction access assignments; transaction site links.
- `supply_sites` → user assignments, lots (origin), inventory entries, inspections, handovers (source/destination), transaction site links.
- `supply_lots` → genealogy parent/child, inventory entries, processing losses, quality inspections, handovers.
- `inventory_movements` → inventory entries and processing losses; posted movements are guarded by triggers.
- `inquiries` → products and optional commercial transaction linkage; tenant attribution columns are explicitly unassigned until reviewed.

## Confirmed source-level blockers

The read-only inspector and synthetic contract test identify five current blockers:

1. Missing `transaction_enterprise_parties` bridge.
2. Missing composite `(tenant_id,transaction_id)` FK for transaction access assignments.
3. Missing composite `(tenant_id,site_id)` FK for transaction access assignments.
4. Missing composite `(tenant_id,transaction_id)` FK for transaction site links.
5. Missing composite `(tenant_id,site_id)` FK for transaction site links.

The intended bridge must prove a tenant is actually either the transaction's buyer or seller. A direct FK to `commercial_transactions(id)` does not prove that relationship. The bridge design, trigger/declarative check, nullable assignment-site semantics, and PostgreSQL equivalent require Security + Database review before any migration candidate.

## Runtime and migration safety boundary

- `createServer()` opens the selected SQLite file and executes schema creation/upgrade statements during startup. **Do not start the API against an unknown or operational DB path for inspection.**
- `API_DB_PATH` is an input to path selection, not proof of the effective path in a running deployment.
- The default source path is `server/data/api.sqlite`; it is not proof of a live service database.
- Migration scripts mutate schema and may add tables/columns/indexes/triggers. Do not execute them against production or staging as part of source reconciliation.
- The source inventory is not a physical schema-only snapshot. Runtime host, entrypoint, working directory, effective DB path, and consistent snapshot are still required to certify the deployed SQLite schema.
- No database file, row data, secrets, operational data, or customer data is included in this report.

## Target PostgreSQL reconciliation gates

1. Obtain authorized, schema-only DDL from the verified runtime database after host/path and snapshot consistency are proven.
2. Compare physical SQLite tables, columns, indexes, triggers, constraints, and FK actions against this source inventory.
3. Reconcile SQLite-only constructs (triggers, JSON checks, partial indexes, integer quantities) to explicit PostgreSQL equivalents.
4. Define tenant-party bridge and composite constraints; document nullable site assignment policy.
5. Enable RLS on every exposed business table; test `USING` and `WITH CHECK` for each role and site scope.
6. Test service/runtime role, grants, pool identity propagation, and RLS under actual application connection behavior.
7. Run all constraint and RLS negative tests against disposable PostgreSQL with wholly synthetic fixtures.
8. Obtain independent Security and Database approval before preparing a migration candidate.

## Disposition

**Source-code reconciliation is delivered as a source inventory and blocker register. Physical database reconciliation remains BLOCKED** pending verified runtime provenance and an authorized schema-only snapshot. No SQL migration was generated or applied. Supabase staging and production remain unchanged.
