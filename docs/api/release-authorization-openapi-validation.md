# Release Authorization OpenAPI 3.1 — Validation Report

**Status:** Previous candidate validation is historical only. Validation of the corrected candidate is pending against the current PR head; do not treat the earlier PASS as covering the new YAML.
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

**Historical run (not current-candidate evidence):** [GitHub Actions run #2](https://github.com/muchlisbstg/export-client-mobile-sync/actions/runs/42449745086) completed successfully for candidate commit `916fa9fe48137e367526c6915a7273e0470469bc`. Redocly lint, bundle/reference resolution, and artifact existence passed on that earlier candidate only.

**Corrected candidate:** Latest YAML correction commit `bba687468613f0f69f0a8de50dc3b27b25d282ad`; blob `1c0675e66de5f4834fb5a1c2a8280bbe4a8326eb`. Subsequent report commits advance the PR head. The final validation record must name the exact resulting head SHA and run ID.

## Approved domain/API decisions

The user explicitly approved the seven recommendations for OAS-001, OAS-003, OAS-007, OAS-010, OAS-011, OAS-012 and OAS-013 as domain/API decisions. Their approval is recorded in `release-authorization-openapi-final-review.md`. This is not a substitute for independent Security, Legal, Database, Engineering, Finance, Syariah or domain reviewer sign-off.

Candidate schema corrections now include: tenant-scoped read-only request listing; seller instruction separate from party approval and append-only supersession/withdrawal; server-owned scope version/status semantics; split suspension clearance submission and verification; clarified approval expected/evaluated version separation and decision timestamps; typed `NOT_STARTED` idempotency reconciliation; durable `FAILED` semantics; server-calculated authorization expiry/invalidation; and transactional outbox commit semantics.

## Remaining independent approvals and contract verification

| ID | Decision | Current treatment | Required owner |
|---|---|---|---|
| OAS-001 | Keep request collection/list endpoint | User-approved; tenant-scoped read-only server enforcement | Security verification |
| OAS-003 | Exact set of contractual party approval types beyond seller and conditional buyer | User-approved; seller instruction distinct; Buyer conditional | Legal mapping |
| OAS-006 | 24-hour approval validity | Frozen policy rule; server calculates expiry from final required approval | Policy owner |
| OAS-007 | Authoritative scope version/status source and version semantics | User-approved append-only server-owned scope decision register | Domain + Database review |
| OAS-010 | Whether seller release instruction can be withdrawn/replaced and by whom | User-approved append-only supersession/withdrawal command | Legal review |
| OAS-011 | Whether suspension clearance submission and clearance verification must be separate HTTP commands | User-approved separate submission and verification operations | Security + domain owner |
| OAS-012 | Exact terminal semantics for a failed execution versus a failed attempt before commit | User-approved durable terminal FAILED; precommit abort remains attempt-only; uncertain commit reconciled | Engineering + Security + Database |
| OAS-013 | Whether missing or unauthorized resources return indistinguishable 404 responses | User-approved 404/403 disclosure policy | Security verification |

## Non-goals and explicit exclusions

- No database schema, DDL, migration, or seed data.
- No API/domain service implementation.
- No guarantee, payment ledger, contract snapshot, or evidence-register implementation implied by this contract.
- No repository changes outside this branch.
- No merge to `main` and no deployment.

## Freeze gate

The pinned validator and bundler passed on the exact candidate SHA with no reported OpenAPI structural or reference-resolution findings. The schema is **not frozen**: the decision owners must still approve or resolve the open items above, and independent domain/security reviews remain outstanding. Independent security, database, legal, financial, and Syariah review remains separate.


## Outstanding independent review gates

- Security: tenant isolation, role/party/domain authorization, maker-checker, veto permissions, idempotency disclosure and replay rules.
- Database/Engineering: release-state + authorization-consumption + audit/outbox atomic commit, concurrency, retry and reconciliation.
- Legal: party approval conditions, seller instruction change rights, jurisdiction and contract mapping.
- Finance and Syariah: payment, guarantee, evidence and release-gate semantics.
- Domain/Product: transaction-scope authority, versioning, bilateral activation/reactivation and protective suspension/withdrawal invariants.

No independent reviewer sign-offs are evidenced yet. Automated CI cannot replace these reviews. Also, the current candidate still requires operation-by-operation response coverage verification for applicable 400/401/403/404/409/422/423/429/500/503 responses and typed Problem schemas.

## Freeze gate

**NOT READY TO FREEZE.** Await exact-head CI PASS, complete response/error contract audit, and independent review evidence. Domain Service Design must not start until a separate freeze decision is recorded.


## Response coverage inventory

A static operation inventory found 20 HTTP operations. Every operation now declares 400, 429 and 500 Problem responses, and duplicate response keys were removed. All 20 operations declare 401 and 403. 404 is applied to resource-specific operations; it is not required for collection listing or creation where no target resource is being read. Operation-specific 409, 422, 423 and 503 responses remain where applicable. This inventory is not a substitute for reviewing the semantics of each response and every success/error media schema.

Latest schema candidate: commit `482f342ed4a6e62d1d00624127b39f34287e264f`, YAML blob `b275e7357ce4f2253a73db118620b8b37ff15793`. The prior CI attempt failed on a YAML parse error (run #18 / ID `42450388713`); the missing closing brace was corrected in this candidate. A new exact-head CI PASS is still required.


## CI failure record

Run #18 (ID `42450388713`) checked PR merge ref `17e68108c33388fa0c35c7f58f55ec0cd6a3965b` and failed during Redocly lint with: `missed comma between flow collection entries` at YAML line 1023. The source was an unclosed inline mapping in `ReleaseAuthorization.invalidation_reason`. It was corrected in commit `482f342ed4a6e62d1d00624127b39f34287e264f`. The failed run is retained as evidence and must not be represented as a pass.
