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
