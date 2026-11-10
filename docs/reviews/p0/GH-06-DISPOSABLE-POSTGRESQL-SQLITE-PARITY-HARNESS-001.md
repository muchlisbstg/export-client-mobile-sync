# GH-06 — PostgreSQL / SQLite Parity Evidence Review

**Status:** SYNTHETIC PARITY CORPUS PASS — CANONICAL DEC-008 ACCEPTANCE STILL OPEN  
**Date:** 2026-11-10  
**Branch:** `review/p0-domain-schema-readonly-2026-11-10`

## Evidence

- Workflow: [GH-06 run 42778235005](https://github.com/muchlisbstg/export-client-mobile-sync/actions/runs/42778235005)
- Tested SHA: `da4534b0b30cfcbc66a64c879e028e519b95d996`
- PostgreSQL: 16.10; SQLite: 3.53.4
- Result: **15 relational/authorization cases + 4 temporal cases = 19 PASS, 0 FAIL**
- Artifact ID: `13744827342`
- Artifact SHA-256: `5c8b41af1742f104be7f917280942135ed122734d4f7b92002c22249301db8d6`
- Relational fixture fingerprint: `c2d24416f24a05191c542d167f7c4cd4c7f280a26bb94d9b01a9d200e4b81166`
- Temporal fixture fingerprint: `1ae6195975a8818ce3a886e3b3f75e55c91ef786eb7f951bf421845dc01c2aac`

## Executed scenarios

The relational runner reports 15 matched PostgreSQL/SQLite outcomes covering participant uniqueness, binding composite FK, membership/site-link assignment constraints, Buyer role uniqueness, valid intervals, Buyer/Seller party distinction, Supplier coexistence, audit immutability, rollback, participant-party match, same-tenant Buyer/Seller rejection, revoked membership, revoked site link, and revoked offline replay.

The temporal runner reports four additional passes:

- PAR-010: two PostgreSQL sessions and two SQLite connections contend on overlapping effective periods; exactly one overlapping write commits.
- PAR-017: adjacent half-open periods are accepted.
- PAR-018: NULL `effective_to` is treated as open-ended.
- PAR-019: UTC microsecond precision is preserved.

The parity runner's transaction rollback case is PAR-016. These IDs are now aligned so the temporal concurrency case is PAR-010 and rollback is PAR-016.

## Acceptance-matrix reconciliation — outstanding gaps

The 19 passing cases are **not** a full pass of the canonical matrix. The current synthetic runner's scenario names and identifiers do not map one-to-one to every KEY/PAR/AUTH row in `DOMAIN-DECISION-ACCEPTANCE-MATRIX-001.md`.

Still requiring explicit, source-pinned acceptance tests include:

- KEY-001 duplicate participant primary key.
- KEY-003 exact participant composite tuple.
- KEY-004 supply-site tenant/id uniqueness and cross-tenant reference.
- KEY-005 assignment participant composite FK as a distinct case.
- KEY-006 site-link participant composite FK as a distinct case.
- KEY-007 assignment site composite FK.
- KEY-008 site-link site composite FK.
- KEY-011 duplicate Seller partial unique index (current explicit duplicate-role fixture covers Buyer).
- KEY-018 controlled status/action vocabulary.
- PAR-002 assignment cross-tenant participant tuple, PAR-003 site-link cross-tenant site tuple, and PAR-008 invalid status/action as defined by the canonical matrix.
- PAR-015 paired ordinary-app-role audit UPDATE and DELETE behavior across both engines.
- Full AUTH-001–AUTH-015 business-operation matrix against the authoritative API and replay pipeline.

Some related properties are exercised by other tests, but related coverage is not equivalent to a direct acceptance test. The current reduced DDL is synthetic and does not represent the complete canonical production schema or all Web/Mobile/Desktop implementations.

## Decision

**GH-06 harness execution: PASS. DEC-008: OPEN.** Do not describe the 19 synthetic passes as complete canonical parity or use them to approve schema freeze. The remaining matrix rows must be implemented as direct tests against canonical DDL and reconciled to the exact acceptance IDs before GH-06 can close.
