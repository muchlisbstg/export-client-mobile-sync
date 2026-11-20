# Export Client — P0 Schema Remediation Work Plan

**Scope:** Read-only findings converted into branch remediation plan. No runtime/schema changes in this commit.
**Baseline:** `main` at `9bce8e7b10790864de32270dd5bf48c7f6b8f81b`
**Branch:** `audit/p0-export-client-schema-remediation`
**Gate:** P0 remains blocked until schema constraints, tenant isolation, transaction integrity, and exact-SHA test evidence pass.

## Findings confirmed from source

The read-only inspector `scripts/inspect-transaction-authorization-schema.mjs` checks the tenant/transaction/site relationships and reports five blockers. The test `test/schema-reconciliation-contract.test.mjs` intentionally creates the migration schema, confirms inspection is read-only, and expects the five finding codes. This is a constructed in-memory test schema, not a live database inspection.

1. `TRANSACTION_TENANT_SCOPE_BRIDGE_MISSING` — `transaction_tenant_scopes` is required to express buyer/seller tenant scopes for a transaction.
2. `ASSIGNMENT_TENANT_TRANSACTION_FK_MISSING` — access assignment must reference the tenant/transaction scope using a composite FK.
3. `ASSIGNMENT_TENANT_SITE_FK_MISSING` — access assignment must reference a site belonging to its tenant.
4. `SITE_LINK_TENANT_TRANSACTION_FK_MISSING` — transaction/site link must reference the matching tenant/transaction scope.
5. `SITE_LINK_TENANT_SITE_FK_MISSING` — transaction/site link must reference a site belonging to its tenant.

## Remediation work packages

- [ ] **EC-P0-05A — Scope bridge design:** decide how each transaction maps to buyer and seller tenant scopes; document uniqueness and allowed scope semantics.
- [ ] **EC-P0-05B — Composite parent keys:** ensure referenced parent tables have exact composite UNIQUE/PRIMARY KEY constraints compatible with SQLite FK rules.
- [ ] **EC-P0-05C — Assignment FKs:** recreate/upgrade `transaction_access_assignments` with tenant-aware transaction and site FKs; preserve data or fail closed on ambiguous rows.
- [ ] **EC-P0-05D — Site link FKs:** upgrade `transaction_site_links` with tenant-aware transaction and site FKs.
- [ ] **EC-P0-05E — Migration safety:** version migration, transactional execution, FK enforcement, preflight report, backup requirement, rollback/restore rehearsal; do not infer tenant ownership for legacy rows.
- [ ] **EC-P0-05F — Negative tests:** cross-tenant transaction/site insert attempts fail; same-tenant valid inserts succeed; missing tenant scopes fail; orphan rows cannot be created.
- [ ] **EC-P0-05G — Exact SHA qualification:** run focused migration/schema tests and full suite on the remediation commit; capture logs, DB integrity checks, FK checks, and commit SHA.
- [ ] **EC-P0-05H — Independent review:** Security and Database reviewers review implementation and evidence before merge/release.

## Required evidence bundle

- ADR / schema diagram with scope bridge semantics.
- Migration source and migration version.
- Synthetic test DB before/after migration; no real customer data.
- `PRAGMA integrity_check` = `ok`.
- `PRAGMA foreign_key_check` returns no rows.
- Negative cross-tenant/site/transaction tests.
- Idempotency and rollback/recovery test output.
- Focused + full test output tied to exact SHA.

## Prohibited until approved

- Running migration on staging or production.
- Real transaction, ledger, or payment operations.
- Merge, deployment, or data mutation outside synthetic test fixtures.
- Declaring P0 PASS from test design alone.

## Next technical sequence

1. Inspect complete table definitions and `migrateSupplyChain` dependencies.
2. Design scope bridge keys and compatible parent composite keys.
3. Implement migration on this branch only.
4. Add failing-before/passing-after negative tests.
5. Execute isolated test suite and record evidence.
