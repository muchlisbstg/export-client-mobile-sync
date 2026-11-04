# Source-Code Schema Reconciliation

**Repository:** `muchlisbstg/export-client-mobile-sync`  
**Baseline:** `main` at `73e75edad71c5a6f8819e80c5ffdeabf32314c3d`  
**Method:** Read-only source inspection of schema bootstrap and migration code.  
**Status:** Logical source inventory completed; physical database reconciliation is NOT completed.

## Scope and provenance

This document inventories DDL declared by:

- `server/index.mjs` — base catalog, inquiry, and legacy peer-sync tables.
- `scripts/migrate-tenant-isolation.mjs` — enterprise, membership, role, transaction, assignment, audit, and tenant outbox tables.
- `server/supply-chain.mjs` — site, lot, inventory, quality, handover, and evidence tables.
- `scripts/inspect-transaction-authorization-schema.mjs` — read-only contract checks for transaction authorization integrity.

The inventory is a logical schema derived from source code. It is **not** a schema dump from a running API, local Termux database, staging database, or production database. Source DDL does not prove that a deployed database has these tables or constraints.

## Declared object inventory

| Domain | Tables | Count |
|---|---|---:|
| Base catalog / inquiry / peer sync | `products`, `inquiries`, `sync_conflicts`, `sync_outbox` | 4 |
| Enterprise / authorization / transaction | `tenants`, `tenant_memberships`, `enterprise_role_assignments`, `enterprise_role_audit`, `supply_site_assignments`, `supply_audit_events`, `commercial_transactions`, `transaction_access_assignments`, `transaction_site_links`, `tenant_sync_outbox` | 10 |
| Supply chain / inventory / QC | `supply_sites`, `supply_lots`, `lot_genealogy`, `inventory_movements`, `processing_losses`, `inventory_entries`, `quality_inspections`, `handovers`, `supply_evidence` | 9 |
| **Total** | **23 declared application tables** | **23** |

Source code also declares 18 explicit named indexes (14 enterprise/transaction/outbox and 4 supply-chain indexes) and 10 triggers (4 append-only audit triggers and 6 inventory/movement integrity triggers). Primary-key and unique-constraint autoindexes are not included in the explicit-index count.

## Relationship map

- `products` → `inquiries.product_id` (base inquiry product reference).
- `inquiries` may be linked to `commercial_transactions.inquiry_id`.
- `commercial_transactions.buyer_tenant_id` and `seller_tenant_id` each reference `tenants.id`; buyer and seller must differ.
- `tenant_memberships`, `enterprise_role_assignments`, and `supply_site_assignments` bind users to the configured enterprise and operational site assignments.
- `supply_sites` belongs to a tenant; `supply_lots` references its origin site.
- `lot_genealogy` links parent and child lots within the same tenant.
- `inventory_movements` groups append-only `inventory_entries`; entries bind movement, lot, and site within the same tenant.
- `processing_losses` references a movement and parent lot.
- `quality_inspections` references a lot and site.
- `handovers` references a lot, source site, and destination site.
- `supply_evidence` uses a polymorphic `entity_type/entity_id` reference; referential validity is enforced in service logic rather than a conventional foreign key.
- `transaction_access_assignments` and `transaction_site_links` connect users, transactions, and operational sites, but their composite tenant/resource foreign-key integrity is incomplete (see blockers).

## Important domain semantics to preserve

- Tenant, user, site, lot, movement, and transaction identifiers are text identifiers in the source model; do not coerce them to UUID without an explicit domain migration.
- Inventory quantities are integer milli-units (`quantity_milli`, `quantity_milli_delta`); preserve as integer/bigint semantics, never floating-point.
- Base inquiry `quantity` is currently SQLite `REAL`; this is distinct from inventory quantity and requires explicit unit/precision mapping before database conversion.
- Money/financial ledger amounts are not part of the currently declared source schema. Financial records and payment flows must be designed separately with exact decimal semantics and independent legal/Syariah approval.
- JSON text fields include audit details, criteria, evidence metadata, and sync payloads; validate JSON before any PostgreSQL `jsonb` conversion.
- Inventory entries and posted movement records are protected by triggers; preserve append-only and stock-nonnegative invariants transactionally.
- Legacy inquiry ownership fields are added additively and remain unassigned by default; do not infer buyer/seller ownership from operational records.

## Source contract blockers

The in-memory, synthetic contract test `test/schema-reconciliation-contract.test.mjs` currently expects five blockers from `inspectTransactionAuthorizationSchema`:

| Finding | Affected object | Consequence |
|---|---|---|
| `TRANSACTION_ENTERPRISE_BRIDGE_MISSING` | Missing `transaction_enterprise_parties` | A transaction can belong to buyer and seller enterprises, but there is no bridge relation to represent both enterprise parties for composite tenant scoping |
| `ASSIGNMENT_TENANT_TRANSACTION_FK_MISSING` | `transaction_access_assignments` | No composite FK binds assignment `(tenant_id, transaction_id)` to a valid transaction-party pair |
| `ASSIGNMENT_TENANT_SITE_FK_MISSING` | `transaction_access_assignments.site_id` | Operational assignment site is not protected by a composite tenant/site FK |
| `SITE_LINK_TENANT_TRANSACTION_FK_MISSING` | `transaction_site_links` | No composite FK binds transaction-site link to a valid transaction-party pair |
| `SITE_LINK_TENANT_SITE_FK_MISSING` | `transaction_site_links.site_id` | Linked site is not protected by a composite tenant/site FK |

These are schema-integrity blockers, not authorization-test failures. Application-layer checks reduce exposure but do not replace relational constraints. Do not generate or apply SQL until Security and Database reviewers approve the intended buyer/seller ownership model and the composite-key design.

## Reconciliation outcome

- **Completed:** source DDL inventory, declared relationship map, key quantity/identifier semantics, trigger/index inventory, and source-level contract blockers.
- **Not completed:** physical schema inspection of the actual API database; deployed runtime identity/path verification; WAL-consistent snapshot; source-vs-physical table/column/index/trigger comparison; PostgreSQL target DDL.
- **No migration SQL has been created or applied.**
- **No staging database has been changed.**
- **No operational/customer/commercial rows have been read, exported, copied, or used as fixtures.**

## Next authorized gate

Before any physical schema artifact is called authoritative:

1. Identify the actual API process, deployment revision, working directory, and service manager.
2. Inspect environment variable names without printing secret values; resolve effective `API_DB_PATH`.
3. Verify file identity and WAL consistency without modifying the source.
4. Run read-only SQLite metadata inspection (`database_list`, `table_info`, `foreign_key_list`, `index_list`, `sqlite_master`, integrity and FK checks).
5. Produce schema-only SQL plus provenance and SHA-256; exclude all row data.
6. Reconcile every physical object against this source inventory and record differences.

If runtime host/path or snapshot consistency cannot be proven, stop. Do not substitute a local database or this source inventory for the deployed schema.
