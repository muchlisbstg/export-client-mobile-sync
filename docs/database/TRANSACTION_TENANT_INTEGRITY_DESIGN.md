# Transaction Tenant Integrity — Design Review Packet

**Status:** DESIGN ONLY — no migration SQL, DDL patch, schema mutation, staging access, or production access is authorized.
**Baseline:** `main` at `9e02871971fde07a5e9c2271960c4e35f3c2b49d`.
**Evidence provenance:** committed source and synthetic in-memory tests only. No deployed database has been inspected.

## 1. Five integrity blockers

| ID | Finding | Affected relation | Required invariant |
|---|---|---|---|
| DB-01 | `TRANSACTION_ENTERPRISE_BRIDGE_MISSING` | `transaction_enterprise_parties` | A transaction party must be exactly its buyer or seller enterprise. |
| DB-02 | `ASSIGNMENT_TENANT_TRANSACTION_FK_MISSING` | `transaction_access_assignments` | Assignment `(tenant_id, transaction_id)` must reference a valid transaction-party pair. |
| DB-03 | `ASSIGNMENT_TENANT_SITE_FK_MISSING` | `transaction_access_assignments` | A non-null `(tenant_id, site_id)` must reference a site owned by the same tenant. |
| DB-04 | `SITE_LINK_TENANT_TRANSACTION_FK_MISSING` | `transaction_site_links` | Site link `(tenant_id, transaction_id)` must reference a valid transaction-party pair. |
| DB-05 | `SITE_LINK_TENANT_SITE_FK_MISSING` | `transaction_site_links` | `(tenant_id, site_id)` must reference a site owned by the same tenant. |

These five findings are still present in the main-branch source contract. They are not marked resolved by this document.

## 2. Candidate relational design — for reviewer decision

### Transaction party bridge

Proposed logical key:

- `transaction_enterprise_parties(tenant_id, transaction_id, party_role)`
- Primary/unique key: `(tenant_id, transaction_id)`
- Role domain: `buyer` or `seller`
- Unique role per transaction: `(transaction_id, party_role)`
- Transaction reference: `transaction_id → commercial_transactions.id`
- Tenant reference: `tenant_id → tenants.id`
- A database-enforced invariant must additionally prove:
  - `party_role = buyer` implies `tenant_id = commercial_transactions.buyer_tenant_id`
  - `party_role = seller` implies `tenant_id = commercial_transactions.seller_tenant_id`

A normal composite FK to a single buyer-or-seller column cannot express this conditional relationship by itself. Reviewers must select and document an engine-specific enforcement mechanism (e.g. constraint trigger or normalized party-key representation). Do not rely on application checks alone.

### Dependent composite foreign keys

After the bridge has a unique `(tenant_id, transaction_id)` key:

- `transaction_access_assignments(tenant_id, transaction_id)` → bridge `(tenant_id, transaction_id)`.
- `transaction_site_links(tenant_id, transaction_id)` → bridge `(tenant_id, transaction_id)`.
- `transaction_access_assignments(tenant_id, site_id)` → `supply_sites(tenant_id, id)`.
- `transaction_site_links(tenant_id, site_id)` → `supply_sites(tenant_id, id)`.

The assignment `site_id` is currently nullable. Database Review must explicitly approve which roles may be enterprise-wide (NULL site) and ensure site-scoped roles cannot bypass site assignment with NULL. Site links remain site-specific.

### Unresolved architecture decision

The runtime is configured as a single enterprise, while commercial transactions store buyer and seller tenant identifiers. Before schema implementation, Security and Database reviewers must decide how the external counterparty is represented: external legal-party tenant, governed counterparty entity, or another explicit model. No buyer/seller mapping or backfill may be inferred from operational rows.

## 3. Tenant-isolation and composite-key verification plan

Synthetic test fixtures must prove all of the following:

1. Buyer party pair is accepted.
2. Seller party pair is accepted.
3. A tenant unrelated to buyer and seller is rejected.
4. Duplicate buyer or seller party rows are rejected.
5. Assignment with valid tenant + transaction + site is accepted.
6. Assignment with another tenant's transaction is rejected.
7. Assignment with another tenant's site is rejected.
8. Site link with valid tenant + transaction + site is accepted.
9. Site link with another tenant's transaction is rejected.
10. Site link with another tenant's site is rejected.
11. NULL assignment site is accepted only for explicitly approved enterprise-wide roles.
12. FK enforcement is enabled and both integrity and FK checks are clean.

SQLite synthetic validation and PostgreSQL integration/RLS validation are separate gates. SQLite passing does not prove PostgreSQL behavior or deployed Supabase state.

## 4. Migration design — not executable SQL

### Preconditions

- Identify the actual target database process, revision, working directory, effective database path, and environment (names only; never expose values).
- Prove physical database identity and consistent read-only snapshot provenance.
- Capture schema-only metadata, migration history, indexes, triggers, FK definitions, integrity/FK check results, and schema fingerprint.
- Reconcile source inventory with the physical database.
- Approve the single-enterprise/counterparty representation and party ownership semantics.
- Inventory existing assignment/site-link tuples and classify invalid/orphaned tuples using synthetic or approved sanitized evidence. No automatic tenant assignment.

### Candidate rollout sequence

1. Build a schema-only candidate in an isolated disposable database.
2. Create the bridge model and enforce buyer/seller membership with the reviewer-selected database mechanism.
3. Validate existing candidate tuples before adding dependent composite FKs.
4. Add the four dependent composite FK constraints.
5. Validate NULL-site policy and role/site authorization alignment.
6. Run positive, negative, cross-tenant, duplicate-party, integrity, FK, concurrency, and application regression tests.
7. Produce pre/post schema diff, row-count/data-preservation evidence, backup/restore evidence, and lock/downtime analysis.
8. Obtain independent Database Review and Security Review against the exact candidate SHA.
9. Only after separate explicit human authorization may a migration artifact be created and later applied to a specifically named environment.

### Engine-specific review

- SQLite may require table rebuilds to add foreign keys. Review transaction boundaries, foreign-key pragma behavior, dependent indexes/triggers, and safe copy/rename strategy.
- PostgreSQL requires a separately reviewed DDL strategy, constraint validation plan, lock impact, and RLS policy tests. Consider staged constraint validation only if it preserves the invariant during rollout.
- Never assume SQLite and PostgreSQL DDL, FK timing, trigger semantics, or RLS behavior are interchangeable.

## 5. Rollback and recovery design — not executable SQL

- Take and verify a restorable backup before any approved rollout.
- Prefer additive, forward-compatible rollout until dependent application code is confirmed.
- If validation fails before constraint activation, discard the isolated candidate; do not touch a shared database.
- If an approved rollout fails, stop writes to the affected schema path if necessary, restore the verified backup or use a reviewer-approved compensating procedure, then run integrity/FK checks and application smoke tests.
- Do not blindly drop bridge or constraint objects if assignments/site links already depend on them. Rollback ordering must reverse dependencies and preserve auditability.
- Record exact pre/post schema fingerprints, migration identifier, operator, timestamps, row counts, errors, recovery decision, and verification results.
- Staging authorization never implies production authorization.

## 6. Current evidence and limitations

- Main contains a read-only inspector and an in-memory contract test. The current test asserts that inspection does not mutate schema and that the five blockers are reported.
- Main contains tenant migration tests using in-memory and disposable temporary SQLite databases, including integrity/FK checks and backup/restore behavior for the existing tenant migration.
- These tests do not implement or validate the proposed transaction-party bridge.
- No live API database identity/path or physical schema has been verified in this work packet.
- No PostgreSQL database or RLS integration test has been executed.
- No migration SQL has been created or applied. No staging/production database has been accessed or changed.

## 7. Review decision record

| Review | Reviewer | Status | Required decision |
|---|---|---|---|
| Domain / counterparty model | Product + Security + Database | BLOCKED | Confirm legal-party representation and buyer/seller semantics |
| Composite FK design | Independent Database reviewer | NOT_STARTED | Approve keys, enforcement mechanism, null-site policy, engine specifics |
| Tenant-isolation policy | Independent Security reviewer | NOT_STARTED | Confirm enterprise and site boundary invariants |
| Migration / rollback plan | Independent Database reviewer | NOT_STARTED | Approve preconditions, rollout, rollback, backup, and recovery |
| Human migration authorization | Authorized owner | NOT_STARTED | Separate authorization per environment |

**No approval is implied by opening or reviewing this PR.**
