# Mobile P0 Domain & Canonical Schema Review Package

**Status:** READ-ONLY REVIEW PACKAGE  
**Branch:** `review/p0-domain-schema-readonly-2026-11-10`  
**Base:** `main` at `0a3c595c6697f56d0cef8536c3b93c3886cc5ab1`  
**Source:** `muchlisbstg/export-client-web-sync` / `docs/integrated-review-package-p0` / `dadedeebdb1e606e7cd436d28935b8f510693a00`

## Package contents

1. [Canonical schema decision register](./CANONICAL-SCHEMA-DECISION-REGISTER-001.md) — DEC-001–005 approved; DEC-006–008 open.
2. [Supplier hybrid domain reconciliation](./DOMAIN-RECONCILIATION-SUPPLIER-HYBRID-ADR-P0-001.md) — resolves the Mobile single-enterprise ADR conflict.
3. [Domain authority and supersession matrix](./DOMAIN-AUTHORITY-AND-SUPERSESSION-MATRIX-001.md) — authority order, conflict disposition and open decisions.
4. [Canonical participant relationship specification](./CANONICAL-PARTICIPANT-RELATIONSHIP-SPEC-001.md) — cardinality, lifecycle, approval, scope and authorization contract.
5. [Domain decision acceptance matrix](./DOMAIN-DECISION-ACCEPTANCE-MATRIX-001.md) — reviewable positive/negative acceptance criteria; not executed.
6. [Canonical entity, key and constraint mapping](./CANONICAL-ENTITY-KEY-CONSTRAINT-MAPPING-001.md) — logical entity/key/FK/check/temporal and cross-engine mapping; not frozen.

## Review sequence

1. Confirm domain authority and supersession.
2. Review participant cardinality and lifecycle.
3. Review canonical entity and candidate-key map.
4. Review all four mandatory composite FKs and participant consistency FK.
5. Resolve Buyer/Seller role uniqueness, binding-version reference, assignment/site-link and membership consistency.
6. Close DEC-006 RLS, DEC-007 SQLite provenance and DEC-008 parity evidence.
7. Only then assess schema-freeze readiness.

## Provenance

The first two documents are copied verbatim from the Web source branch. The other documents are Mobile review artifacts derived from the approved decision register and canonical schema specification. Source files remain unchanged.

- Decision register source SHA: `8e5349513275550ab5079b82b2eba9aeda6c332b`
- Supplier hybrid reconciliation source SHA: `179526cdf869c4e86e80f660a2efaf1a6df78d50`
- Canonical PostgreSQL–SQLite specification source SHA: `c1395b01ce6b5c80abfe5661a1e64e893a2d87d2`

## Governance boundary

This branch is a documentation-only review package. It does not change runtime code or database schema. No DDL, migration, test execution against shared/live systems, PR, merge, deployment or staging/production mutation is authorized. Implementation readiness remains **NOT READY** pending technical/evidence gates.
