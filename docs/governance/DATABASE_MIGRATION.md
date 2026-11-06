# Database Schema Reconciliation & Migration Gate

**Gate:** Mandatory before creating or applying a database migration.

## Required sequence

1. Identify the actual database instance and environment. Record process entrypoint, working directory, effective database path, and relevant environment variable names without exposing secret values.
2. Confirm the target database identity before inspection. Never assume a default or similarly named SQLite file is the target.
3. Perform schema-only inspection where possible: tables, columns, types, nullability, defaults, primary keys, foreign keys, indexes, triggers, migration history, and relevant constraints.
4. Inventory source-of-truth models, migration scripts, query assumptions, and runtime schema expectations.
5. Reconcile actual schema against source and migration history. Document missing, extra, divergent, and ambiguous elements.
6. Produce a schema reconciliation report and obtain independent Database Review.
7. Only after approval, prepare a migration with explicit forward/rollback or recovery strategy, idempotency expectations, data preservation analysis, and locking/downtime assessment.
8. Test on an isolated, representative copy with backup/restore verification.
9. Obtain explicit human authorization for each staging or production application. Staging approval does not authorize production.

## Prohibited actions before approval

- Do not create a migration based on assumed schema.
- Do not run migration scripts against staging or production.
- Do not use a production database for exploratory tests.
- Do not silently repair schema drift or rewrite migration history.
- Do not expose credentials, connection strings, or sensitive records in logs or reports.

## Reconciliation report template

| Object | Actual schema | Source/migration expectation | Difference | Risk | Resolution | Reviewer/status |
|---|---|---|---|---|---|---|
| TBD | TBD | TBD | TBD | TBD | TBD | NOT_STARTED |

Include database identity, inspection timestamp, schema fingerprint if available, migration history, FK/index inventory, and limitations.

## Migration test evidence

- Representative isolated database and provenance.
- Pre/post schema comparison.
- Data preservation and row-count/reconciliation checks.
- Repeated-run/idempotency behavior where required.
- Failure injection and rollback/recovery evidence.
- Locking, concurrency, and application compatibility results.
- Backup and restore evidence.

## Approval

Database Review must be independent of the migration author. `APPROVED` requires the reconciliation report, test evidence, reviewer identity, and timestamp. A human must separately authorize applying the migration to each environment.
