# GH-06 — PostgreSQL / SQLite Parity Evidence Review

**Status:** SYNTHETIC PARITY CORPUS PASS — CANONICAL DEC-008 ACCEPTANCE STILL OPEN  
**Date:** 2026-11-10  
**Branch:** `review/p0-domain-schema-readonly-2026-11-10`

## Evidence

- Workflow: [GH-06 run 42780099356](https://github.com/muchlisbstg/export-client-mobile-sync/actions/runs/42780099356)
- Tested SHA: `e4f508fd20ecf4eb6dbe2f769c20962f26b6c11e`
- PostgreSQL: 16.10; SQLite: 3.53.4
- Result: **15 relational/authorization cases + 4 temporal cases = 19 PASS, 0 FAIL**
- Artifact ID: `13745991104`
- Artifact SHA-256: `17086ddf15524520e402257e44da80c82f0a78d81addb67e418b163c77b8b75f`
- Relational fingerprint: `c2d24416f24a05191c542d167f7c4cd4c7f280a26bb94d9b01a9d200e4b81166`
- Temporal fingerprint: `1ae6195975a8818ce3a886e3b3f75e55c91ef786eb7f951bf421845dc01c2aac`

## Executed scenarios

The relational fixture reports 15 passes covering participant uniqueness, binding composite FK, cross-tenant membership assignment, exact site-link tuple, duplicate Buyer role, invalid effective interval, Buyer/Seller legal-party distinction, Supplier coexistence, audit immutability, rollback, role-party match, same-tenant Buyer/Seller rejection, revoked membership, revoked site link, and revoked offline replay.

The temporal fixture reports four passes:

- PAR-010: two PostgreSQL sessions and two SQLite connections contend on overlapping effective periods; exactly one overlapping write commits.
- PAR-017: adjacent half-open periods are accepted.
- PAR-018: NULL `effective_to` is treated as open-ended.
- PAR-019: UTC microsecond precision is preserved.

The relational rollback case is PAR-016. Both runners are synthetic fixtures; neither loads the complete canonical production DDL.

## Canonical acceptance-matrix gaps

The runner's existing scenario IDs/names do not map one-to-one to every row in `DOMAIN-DECISION-ACCEPTANCE-MATRIX-001.md`. A passing test with a similar concept is not automatically equivalent to the matrix's required negative/positive case.

Direct tests still required include:

- KEY-001 duplicate participant primary key.
- KEY-003 exact participant composite tuple.
- KEY-004 supply-site tenant/id composite key.
- KEY-005 assignment participant composite FK.
- KEY-006 site-link participant composite FK.
- KEY-007 assignment site composite FK.
- KEY-008 site-link site composite FK.
- KEY-011 duplicate Seller partial unique index (current explicit duplicate-role fixture covers Buyer).
- KEY-018 controlled status/action vocabulary.
- Canonical PAR-002, PAR-003 and PAR-008 as defined in the matrix; their current runner IDs describe different cases.
- Direct PAR-015 audit UPDATE and DELETE under an ordinary application role in both engines; GH-05 separately tests app_api audit write denial.
- Full AUTH-001–AUTH-015 against the authoritative API and actual offline replay pipeline.

The complete canonical schema, production route contracts, approval evidence, lifecycle transitions and Web/Mobile/Desktop parity are not yet represented.

## Decision

**GH-06 harness execution: PASS. DEC-008: OPEN.** Do not describe the 19 synthetic passes as complete canonical parity or use them to approve schema freeze. Complete the missing direct acceptance tests, align test identifiers with the normative matrix, and execute against canonical DDL before closing GH-06.
