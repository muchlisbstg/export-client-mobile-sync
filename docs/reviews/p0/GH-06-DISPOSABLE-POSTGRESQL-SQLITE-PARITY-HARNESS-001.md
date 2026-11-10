# GH-06-DISPOSABLE-POSTGRESQL-SQLITE-PARITY-HARNESS-001

**Status:** EXECUTABLE PARITY SUBSET ADDED — FULL DEC-008 REMAINS OPEN
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

Each case compares normalized accepted/rejected outcomes rather than raw engine error messages.

## 3. Scope limitations

This is a first executable subset, not full DEC-008 acceptance. It does not yet exercise concurrent overlapping temporal writes, full lifecycle transition graph, revoked offline command replay, approval evidence, all 16 previously listed scenarios, or complete production schema fingerprints. PostgreSQL RLS is separately tested by GH-05 and cannot be claimed equivalent in SQLite.

The runner must be executed only with a disposable PostgreSQL service. It uses synthetic identifiers and never loads production records.

## 4. Closure criteria

DEC-008 remains OPEN until the complete accepted schema contract is represented in both engines; all PAR-001–016 scenarios are executable; concurrency and rollback tests pass; engine versions and schema fingerprints are retained; all divergences are dispositioned; and the exact tested commit SHA is reviewed.
