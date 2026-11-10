# GH-06 — PostgreSQL / SQLite Parity Evidence Review

**Status:** SYNTHETIC CANONICAL ACCEPTANCE CORPUS PASS — PRODUCTION SCHEMA PARITY OPEN  
**Date:** 2026-11-10  
**Branch:** `review/p0-domain-schema-readonly-2026-11-10`  
**Tested SHA:** `1ea10b53a6579a135daff15ed72e2d7570a0a2dc`

## Evidence

- Workflow: [GH-06 run 42801376099](https://github.com/muchlisbstg/export-client-mobile-sync/actions/runs/42801376099)
- Combined disposable gates: [run 42801375796](https://github.com/muchlisbstg/export-client-mobile-sync/actions/runs/42801375796)
- PostgreSQL 16.10; SQLite 3.53.4.
- Relational corpus: **25 PASS, 0 FAIL**.
- Temporal/concurrency corpus: **4 PASS, 0 FAIL**.
- Total: **29 PASS, 0 FAIL**.
- Artifact ID: `13757005838`; SHA-256: `4a9b9d3f0a2f5a14a9775ad761d420bd4b18521b7a9a5ab79627a2e8b89cdce5`.
- Relational schema fingerprint: `c2d24416f24a05191c542d167f7c4cd4c7f280a26bb94d9b01a9d200e4b81166`.
- Temporal schema fingerprint: `1ae6195975a8818ce3a886e3b3f75e55c91ef786eb7f951bf421845dc01c2aac`.
- Parity runner SHA-256: `ae4aadeb22a3dbec25f20757ce07933daac2830dc5f761e0fd3f65865973e9cb`.
- Temporal runner SHA-256: `73ffff85409d07f14f6fa2659b3082b4c5cb2323a1055e2ef2a476c727bb7d20`.

## Canonical PAR-001–PAR-019 mapping

| Acceptance | Test evidence |
|---|---|
| PAR-001 duplicate tenant/transaction participant | PAR-001 |
| PAR-002 assignment cross-tenant participant tuple | PAR-002 |
| PAR-003 site-link cross-tenant site tuple | PAR-003 |
| PAR-004 duplicate Buyer/Seller role | PAR-004 + PAR-004B |
| PAR-005 binding version tenant/legal-party mismatch | PAR-005 |
| PAR-006 assignment cross-tenant membership | PAR-006 |
| PAR-007 exact site-link tuple mismatch | PAR-007 |
| PAR-008 invalid status/action vocabulary | PAR-008 + PAR-008B |
| PAR-009 invalid effective period | PAR-009 |
| PAR-010 concurrent overlapping binding writes | Temporal PAR-010 |
| PAR-011 Buyer/Seller participant party match | PAR-011 |
| PAR-012 same tenant Buyer/Seller rejection | PAR-012 |
| PAR-013 revoked membership/site link | PAR-013 + PAR-013B |
| PAR-014 revoked offline event replay | PAR-014 |
| PAR-015 audit mutation by ordinary app role | PAR-015 |
| PAR-016 multi-step rollback atomicity | PAR-016 |
| PAR-017 adjacent half-open periods | Temporal PAR-017 |
| PAR-018 open-ended NULL effective_to | Temporal PAR-018 |
| PAR-019 UTC microsecond precision | Temporal PAR-019 |

## KEY-001–KEY-020 mapping

| Key criteria | Test evidence |
|---|---|
| KEY-001 participant PK | KEY-001 duplicate ID rejection |
| KEY-002 tenant/transaction participant uniqueness | PAR-001 |
| KEY-003 exact participant composite tuple | PAR-002 |
| KEY-004 tenant/site composite identity | KEY-004 duplicate tuple rejected; same site ID across tenants accepted |
| KEY-005 assignment participant composite FK | PAR-002 |
| KEY-006 site-link participant composite FK | KEY-006 |
| KEY-007 assignment site composite FK | KEY-007 |
| KEY-008 site-link site composite FK | PAR-003 |
| KEY-009 participant binding-version FK | PAR-005 |
| KEY-010 Buyer partial unique index | PAR-004 |
| KEY-011 Seller partial unique index | PAR-004B |
| KEY-012 membership composite FK | PAR-006 |
| KEY-013 exact site-link composite FK | PAR-007 |
| KEY-014 active membership runtime check | PAR-013 |
| KEY-015 active site-link runtime check | PAR-013B |
| KEY-016 temporal uniqueness | Temporal PAR-010 |
| KEY-017 effective interval constraints | PAR-009 + Temporal PAR-017/018 |
| KEY-018 controlled vocabularies | PAR-008 + PAR-008B |
| KEY-019 Buyer/Seller party match | PAR-011 |
| KEY-020 Buyer/Seller tenant distinctness | PAR-012 |

The positive fixture rows also exercise valid participant, binding, membership, site-link, assignment, action and temporal states. This is a synthetic fixture mapping; it is not a substitute for running against the full canonical production DDL.

## Findings and limitations

- All 19 PAR acceptance scenarios now have an explicit test mapping, including concurrent temporal writes and offline replay.
- All 20 KEY criteria have direct or paired constraint/runtime evidence in the synthetic corpus.
- PostgreSQL and SQLite produced matching expected outcomes for the tested fixtures.
- The corpus is synthetic and deliberately scoped. It does not import the complete canonical schema, actual production migrations, production API routes, or all database objects.
- AUTH-001–AUTH-015 are API authorization acceptance criteria, not all proven by GH-06. GH-09 currently tests a disposable adapter; the authoritative production API remains blocked.
- Schema fingerprint equality here identifies the fixture scripts, not equivalence to production schema.

## Decision

**GH-06 synthetic parity acceptance corpus: PASS (29/29).**  
**DEC-008 production/canonical schema parity: OPEN.**

Do not use this result to approve schema freeze. The remaining gate is canonical DDL parity, real migration/schema reconciliation, and production runtime provenance. No migration, staging/production DB mutation, application connection, merge or deployment was performed.
