# P0 Schema Reconciliation — remediation contract

**Status: remediation preparation; no PostgreSQL migration generated or applied.**

## Baseline and guardrails

- Repository baseline: `c74e29b0a8e3a12cb01d6dc3f9998d47012683b3`.
- Target Supabase project is not accessed by this branch.
- Staging DDL, data, migration history, and settings are not changed.
- No operational SQLite database is opened or copied. Tests use an in-memory synthetic database only.
- No migration is authorized by this document.
- Production and all staging environments remain untouched.

## Verified schema gap

The current SQLite schema defines `transaction_access_assignments` and `transaction_site_links` with separate foreign keys to tenant and transaction identifiers. It does not enforce that the tenant belongs to the referenced transaction, nor that the optional/required site belongs to the same tenant.

The current `supply_sites` table has a composite uniqueness constraint on `(tenant_id,id)`, which can support a composite foreign key. A transaction, however, can belong to either the buyer or seller enterprise. A direct single-column foreign key cannot prove that `tenant_id` is one of those two parties.

The new read-only contract inspector reports these five blockers on the current schema:
1. Missing `transaction_enterprise_parties` bridge.
2. Missing composite tenant/transaction FK from transaction assignments.
3. Missing composite tenant/site FK from transaction assignments.
4. Missing composite tenant/transaction FK from transaction site links.
5. Missing composite tenant/site FK from transaction site links.

## Required target model for review

A future schema PR should propose:

- `transaction_enterprise_parties(tenant_id, transaction_id, party_role)` with primary key `(tenant_id, transaction_id)`.
- Foreign keys from the bridge to `tenants(id)` and `commercial_transactions(id)`.
- A database constraint mechanism (trigger or equivalent declarative design) proving each bridge row's tenant equals either `buyer_tenant_id` or `seller_tenant_id`.
- Composite foreign keys from assignments and site links to the bridge.
- Composite foreign keys from assignment/site-link `(tenant_id,site_id)` to `supply_sites(tenant_id,id)`; assignment `site_id` remains nullable only for roles whose policy permits enterprise-wide scope.
- Matching PostgreSQL constraints and RLS policy tests. SQLite-only validation is not evidence of PostgreSQL RLS behavior.

## Acceptance gates

- The schema inspector returns zero blockers after the approved schema candidate is implemented in an isolated test database.
- Negative tests reject a tenant that is not a buyer/seller party to the transaction.
- Negative tests reject a site from another tenant.
- Positive tests accept buyer-side and seller-side transaction party links.
- Assignment tests reject mismatched tenant/transaction/site tuples.
- PostgreSQL integration tests verify FK behavior and RLS independently.
- A schema diff and rollback review are approved before any staging migration is considered.

## Explicit non-goals

This branch does not generate or apply a PostgreSQL migration, create Supabase objects, change RLS, seed data, inspect production data, or start functional E2E. Those activities remain behind the P0 schema review gate.


## Source-level reconciliation (2026-11-04)

**Reviewed source baseline:** `main` at `73e75edad71c5a6f8819e80c5ffdeabf32314c3d`. This section is derived from committed source/migration definitions only; it is not a live database inspection.

### Source inventory

| Source | Source-defined objects | Responsibility |
|---|---:|---|
| `server/index.mjs` | 4 core tables | `products`, `inquiries`, `sync_conflicts`, `sync_outbox`; core startup schema and RFQ/replication records |
| `scripts/migrate-tenant-isolation.mjs` | 10 tables | tenants, memberships, enterprise roles/audit, site assignments/audit, commercial transactions, transaction assignments/site links, tenant outbox |
| `server/supply-chain.mjs` | 9 tables | supply sites/lots/genealogy, inventory movements/entries, processing losses, QC inspections, handovers, evidence |
| **Total** | **23 source-defined tables** | Counts are source declarations, not a claim about any deployed database |

The `migrateTenantIsolation(db)` routine creates tenant and transaction tables and then calls the supply-chain schema routine. The `migrate-supply-chain.mjs` CLI wrapper calls that same migration path. The API entrypoint also creates core tables during `createServer()`; starting it against an unknown database is not a safe inspection method.

### Relationship reconciliation

- `products.id` is referenced by `inquiries.product_id`.
- `tenants.id` anchors memberships, enterprise role assignments, site assignments, audit events, and commercial transaction party columns.
- `commercial_transactions` stores `buyer_tenant_id` and `seller_tenant_id`; the two IDs must differ.
- `supply_sites` has unique keys `(tenant_id,id)` and `(tenant_id,site_code)`.
- Supply-chain operational tables use composite tenant-scoped references: lots to origin sites; genealogy to parent/child lots; movements/losses/entries to tenant-scoped movements and lots; entries/inspections/handovers to tenant-scoped sites and lots.
- `transaction_access_assignments` currently has separate single-column references to tenant and transaction; its `site_id` has no tenant/site composite FK.
- `transaction_site_links` currently has separate single-column references to tenant and transaction; its `site_id` has no tenant/site composite FK.
- `supply_evidence` stores a polymorphic entity type/id pair. The service performs entity/site authorization; the schema does not express a foreign key across all possible entity tables.

### Reconciled blockers

The read-only inspector and synthetic contract test identify the same five gaps:

1. No `transaction_enterprise_parties` bridge to represent the transaction's buyer/seller party tuple.
2. No composite `(tenant_id, transaction_id)` FK from transaction access assignments to the party bridge.
3. No composite `(tenant_id, site_id)` FK from transaction access assignments to supply sites.
4. No composite `(tenant_id, transaction_id)` FK from transaction site links to the party bridge.
5. No composite `(tenant_id, site_id)` FK from transaction site links to supply sites.

The existing supply-chain tables demonstrate the intended tenant-scoped composite-FK pattern. The transaction authorization tables have not yet adopted that pattern.

### Architecture alignment decision still required

The runtime uses one configured `SINGLE_ENTERPRISE_ID`, while transaction records retain buyer/seller party identifiers and the proposed ADR uses a transaction-party bridge. Before a PostgreSQL schema candidate is authored, Security and Database reviewers must confirm whether the counterparty is represented as an external legal-party tenant, an internal enterprise role, or another explicitly governed entity. Do not infer this mapping or backfill operational rows automatically.

### What is complete and what remains blocked

- **Complete at source level:** object inventory, key relationship map, five integrity blockers, and a read-only synthetic test proving inspection does not mutate schema.
- **Not complete at database level:** actual runtime database identity/path, PostgreSQL DDL/RLS behavior, production/staging schema comparison, data-quality/backfill assessment, and migration/rollback review.
- No staging database was queried or modified. No operational data was read, exported, or copied. No SQL migration was created or applied.
