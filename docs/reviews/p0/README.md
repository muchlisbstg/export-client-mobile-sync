# Mobile P0 Domain & Canonical Schema Review Package

**Status:** READ-ONLY REVIEW PACKAGE  
**Branch:** `review/p0-domain-schema-readonly-2026-11-10`  
**Base:** `main` at `0a3c595c6697f56d0cef8536c3b93c3886cc5ab1`  
**Latest review commit:** pending verification  
**Source:** `muchlisbstg/export-client-web-sync` / `docs/integrated-review-package-p0` / `dadedeebdb1e606e7cd436d28935b8f510693a00`

## Package contents

1. [Canonical schema decision register](./CANONICAL-SCHEMA-DECISION-REGISTER-001.md) — DEC-001–005 approved; DEC-006–008 open.
2. [Supplier hybrid domain reconciliation](./DOMAIN-RECONCILIATION-SUPPLIER-HYBRID-ADR-P0-001.md) — resolves the Mobile single-enterprise ADR conflict.
3. [Domain authority and supersession matrix](./DOMAIN-AUTHORITY-AND-SUPERSESSION-MATRIX-001.md) — authority order, conflict disposition and open decisions.
4. [Canonical participant relationship specification](./CANONICAL-PARTICIPANT-RELATIONSHIP-SPEC-001.md) — cardinality, lifecycle, binding version, membership and exact site-link references.
5. [Domain decision acceptance matrix](./DOMAIN-DECISION-ACCEPTANCE-MATRIX-001.md) — positive/negative acceptance criteria and DEC-006–008 evidence gates; not executed.
6. [Canonical entity, key and constraint mapping](./CANONICAL-ENTITY-KEY-CONSTRAINT-MAPPING-001.md) — complete logical mapping for review; not frozen.
7. [Integrity gap resolution](./INTEGRITY-GAP-RESOLUTION-001.md) — four resolved design choices, caveats and engine parity.

## Four integrity gaps

- G-01: participant pins exact tenant/legal-party binding version through a composite FK.
- G-02: Buyer and Seller each have a separate partial unique index per transaction.
- G-03: assignment references stable tenant membership ID + tenant through a composite FK.
- G-04: assignment references exact site-link ID and complete tenant/transaction/participant/site tuple through a composite FK.

## Review sequence

1. Review/accept the four gap resolutions.
2. Review full candidate-key and composite-FK map.
3. Review PostgreSQL/SQLite trigger, partial-index, temporal and connection requirements.
4. Close DEC-006 RLS design.
5. Evidence DEC-007 SQLite runtime provenance.
6. Execute DEC-008 parity corpus only on disposable databases and pinned versions.
7. Reconcile legacy data, backend authorization and cross-platform contracts.
8. Only then assess schema-freeze readiness.

## Provenance

The decision register and Supplier reconciliation are copied from the Web review package; source files remain unchanged.

- Decision register source SHA: `8e5349513275550ab5079b82b2eba9aeda6c332b`
- Supplier hybrid reconciliation source SHA: `179526cdf869c4e86e80f660a2efaf1a6df78d50`
- Canonical PostgreSQL–SQLite source SHA: `c1395b01ce6b5c80abfe5661a1e64e893a2d87d2`

## Governance boundary

Documentation-only review branch. No source-code changes, DDL, migration, database execution, shared/live tests, PR, merge, deployment or staging/production mutation is authorized. DEC-006–008 remain open and implementation readiness remains **NOT READY**.
