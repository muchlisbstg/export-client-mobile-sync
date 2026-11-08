# Release Authorization OpenAPI 3.1 — Validation Report

**Status:** Draft; automated validation pending.
**Specification:** [release-authorization.openapi.yaml](./release-authorization.openapi.yaml)
**Target standard:** OpenAPI 3.1.0
**Validator:** Redocly CLI 1.34.5 (pinned in GitHub Actions)
**Execution boundary:** GitHub branch only. No local project checkout, DDL, migration, application implementation, merge, or deployment.

## Contract changes consolidated

1. Veto and suspension use separate resources, states, and clearance operations.
2. Execution reconciliation is available by the original idempotency key. A timeout is not treated as proof of failure; retry permission is server-derived.
3. Approval invalidation is a server-side consequence of material fact changes. No client-controlled invalidation endpoint is exposed.
4. Approval records carry the contract snapshot and evaluated source versions. Expiry is server-set to 24 hours after the final required approval.
5. Scope status/version is included in the evaluated version set. Scope reactivation remains bilateral.
6. QC is represented as a quality gate only and cannot create release authorization.
7. The API contract describes bearer JWT authentication and stable RFC 9457-style application error codes.

## Automated validation

The GitHub Actions workflow `.github/workflows/openapi-validation.yml` runs:
- `redocly lint --extends=spec` against the OpenAPI document.
- `redocly bundle` to resolve references and produce a bundled artifact.
- A non-empty artifact check.

**Run result:** Pending GitHub Actions execution. This report must be updated with the exact workflow run URL, candidate commit SHA, and pass/fail outcome before the specification is considered parser-validated.

## Decisions requiring explicit approval before schema freeze

| ID | Decision | Current treatment | Required owner |
|---|---|---|---|
| OAS-001 | Keep request collection/list endpoint | Included as read-only convenience | Product/API owner |
| OAS-003 | Exact set of contractual party approval types beyond seller and conditional buyer | Extensible string; server policy defines requirements | Legal + business owner |
| OAS-006 | 24-hour approval validity | Frozen policy rule; server calculates expiry from final required approval | Policy owner |
| OAS-007 | Authoritative scope version/status source and version semantics | Contract carries scope version and status; source binding needs domain design | Domain owner |
| OAS-010 | Whether seller release instruction can be withdrawn/replaced and by whom | No withdrawal endpoint; instruction history is retained | Legal + business owner |
| OAS-011 | Whether suspension clearance submission and clearance verification must be separate HTTP commands | One clearance resource accepts explicit action values; server authorization must distinguish submitter and verifier | Security + domain owner |
| OAS-012 | Exact terminal semantics for a failed execution versus a failed attempt before commit | Lookup distinguishes FAILED and RECONCILIATION_REQUIRED; transactional boundary must be specified in service design | Engineering + security reviewer |
| OAS-013 | Whether missing or unauthorized resources return indistinguishable 404 responses | Contract permits 403/404; disclosure policy must be selected consistently | Security owner |

## Non-goals and explicit exclusions

- No database schema, DDL, migration, or seed data.
- No API/domain service implementation.
- No guarantee, payment ledger, contract snapshot, or evidence-register implementation implied by this contract.
- No repository changes outside this branch.
- No merge to `main` and no deployment.

## Freeze gate

The schema is **not frozen** until the pinned validator and bundler pass on the exact candidate SHA, all validation findings are resolved, and the decision owners approve the open items above. Independent security, database, legal, financial, and Syariah review remains separate.
