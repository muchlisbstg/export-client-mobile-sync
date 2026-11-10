# GH-06-DISPOSABLE-POSTGRESQL-SQLITE-PARITY-HARNESS-001

**Status:** 19 SYNTHETIC PARITY CASES IMPLEMENTED — FULL CANONICAL DEC-008 REMAINS OPEN
**Date:** 2026-11-10
**File:** `tests/p0-db-gates/parity-test.mjs`

## 1. Execution model

The runner uses one ephemeral PostgreSQL connection and an in-memory SQLite database. Both receive equivalent DDL and deterministic synthetic fixtures. SQLite foreign-key enforcement is enabled explicitly. PostgreSQL uses temporary tables so the harness does not create persistent application tables. No staging/production connection string is accepted by the workflow.

## 2. Executable cases

- PAR-001 duplicate tenant/transaction participant key.
- PAR-002 binding tenant/legal-party composite FK.
- PAR-003 cross-tenant membership assignment.
- PAR-004 exact site-link tuple mismatch.
- PAR-005 duplicate Buyer role across independent tenants.
- PAR-006 invalid effective interval.
- PAR-007 Buyer/Seller legal-party distinction.
- PAR-008 multiple independent Supplier tenants allowed.
- PAR-009 audit history immutability.
- PAR-010 multi-step transaction rollback atomicity.
- PAR-011 Buyer/Seller participant legal-party match.
- PAR-012 one tenant cannot occupy both Buyer and Seller participant rows for a transaction.
- PAR-013 revoked membership denies assignment authorization.
- PAR-014 revoked site link denies assignment authorization.
- PAR-015 revoked membership blocks offline command replay.
- PAR-016 overlapping temporal writes serialize; exactly one transaction commits.
- PAR-017 adjacent half-open effective periods are accepted.
- PAR-018 NULL end time represents an open-ended effective period.
- PAR-019 UTC microsecond timestamp precision is preserved.

Each case compares normalized accepted/rejected outcomes rather than raw engine error messages.

## 3. Scope limitations

The current harness executes 15 synthetic relational/authorization scenarios plus four synthetic temporal/concurrency scenarios (PAR-001–019). The temporal runner uses two PostgreSQL sessions with a tenant-row serialization lock and two SQLite connections with writer serialization. The verified temporal cases include overlap rejection under concurrent writes, adjacent half-open periods, open-ended NULL periods, and UTC microsecond precision.

This is still **not full DEC-008 acceptance**. Both runners use a deliberately reduced synthetic schema, not the complete canonical production DDL or all three platform implementations. PAR-013–015 exercise equivalent authorization predicates in synthetic fixtures, not the actual authoritative API or offline replay pipeline. Approval evidence, complete lifecycle transitions, production schema fingerprints, and route-by-route cross-platform parity remain open. PostgreSQL RLS is separately tested by GH-05 and cannot be claimed equivalent in SQLite.

The successful temporal run at code SHA `3511bfa0c8e45dfe70be85b01d6df1ea7b4f383d` reported PAR-016–019: 4 PASS, 0 FAIL. The later parity correction removes a fixture-only nonexistent assignment status predicate; the latest rerun is tracked separately.

The runner must be executed only with a disposable PostgreSQL service. It uses synthetic identifiers and never loads production records.

## 4. Closure criteria

DEC-008 remains OPEN until the complete accepted schema contract is represented in both engines; PAR-001–019 are executable and pass; the complete canonical production schema and all remaining domain acceptance criteria are represented; concurrency and rollback tests pass; engine versions and schema fingerprints are retained; all divergences are dispositioned; and the exact tested commit SHA is reviewed.
