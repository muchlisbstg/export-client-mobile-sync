# OpenAPI 3.1 — Final Review Readiness & Decision Register

**Review target:** PR #131, branch `docs/p0-001-release-authorization-openapi-2026-11-08`
**Schema correction commit:** `bf336164398893723b9adb9080de0cd47628fbb8` (candidate YAML blob `ae248b0d7d894d5354cce842c27b7082f5f68735`). A subsequent report commit will advance the PR head; validation must target the final resulting head SHA.
**Specification blob:** `bf18f16b6dbdbc590cba43671f5632a8bf733b75`
**Review outcome:** NOT READY TO FREEZE
**Scope:** Contract semantics and governance review only. No DDL, migration, application implementation, merge, or deployment.

## Executive result

The OpenAPI 3.1 document passes the recorded Redocly lint and bundle/reference-resolution workflow. That validates syntax and structural consistency; it does not establish business-policy approval, complete response semantics, authorization enforcement, or implementation correctness.

No PR reviews or inline review threads were present at the time of this review. Independent Database, Security, Legal, Finance, and Syariah sign-offs are not evidenced.

## OAS-001 through OAS-013 decision register

| ID | Proposed resolution | Approval status / owner |
|---|---|---|
| OAS-001 | Retain `GET /release-authorizations/requests` as a read-only, tenant-scoped paginated collection. Apply server-side membership and row-level authorization; never accept tenant identity from the caller. | **APPROVED by user — domain/API decision**; security enforcement still requires independent review |
| OAS-002 | Treat OpenAPI BearerAuth as authentication documentation only. All roles, party authority, site/transaction assignment, separation-of-duties and veto permissions must be enforced server-side; vendor extensions are not enforcement. | Security owner sign-off required |
| OAS-003 | Preserve the frozen matrix: seller release instruction is mandatory; buyer approval is conditional on signed contract/applicable law. No additional party approval is mandatory unless the signed contract or applicable law requires it. Do not imply a generic extra party approval by default. | **APPROVED by user — domain/API decision**; Legal mapping remains independently reviewable |
| OAS-004 | Keep veto and suspension as separate records, lifecycle transitions, audit events and clearance decisions. Clearance of either is not release authorization. | Design resolution incorporated; Security/domain review required |
| OAS-005 | Retain reconciliation by the original idempotency key. Same tenant + operation + key + canonical payload hash returns the prior result; same key with a different payload returns 409. A timeout never authorizes a new key or blind duplicate execution. | Design resolution incorporated; Engineering/Security review required |
| OAS-006 | Approval validity is 24 hours from the final required approval; timestamps and expiry are server-calculated. Material changes invalidate affected approvals; no restoration of invalidated approvals. | User-approved policy decision; ensure schema represents it without client control |
| OAS-007 | Server-owned, append-only transaction-scope decision/version record linked to contract and signed contract snapshot. Current state is derived only from valid bilateral activation/reactivation or permitted protective suspension/withdrawal events. Release evaluation consumes its version and status. | **APPROVED by user — domain/API decision**; authoritative source binding remains subject to independent domain/database review |
| OAS-008 | Require a durable atomic boundary for goods-release state change, authorization consumption, and an audit/outbox event. If external audit export is asynchronous, the outbox record must commit in the same transaction; never report committed release before that durable commit. | Engineering + Security + Database review required |
| OAS-009 | Keep `NOT_APPLICABLE` server-policy-engine-only. The client cannot submit or override gate applicability. | Design resolution incorporated; policy-engine tests required |
| OAS-010 | Seller instructions are append-only. Authorized Seller may append a superseding/withdrawal decision before execution; record actor, reason and timestamp. Any change invalidates dependent approvals and active authorization. After execution, correction is a compensating/audit event, never deletion. | **APPROVED by user — domain/API decision**; Legal review remains outstanding |
| OAS-011 | Suspension clearance is split into separate submission and verification commands. Enforce maker-checker: submitter cannot verify own clearance; only the authorized owner of the underlying hold can verify/reject. | **APPROVED by user — domain/API decision**; Security/domain enforcement review remains outstanding |
| OAS-012 | `FAILED` only for a durable, terminal, recorded execution outcome proving goods release did not commit. Pre-commit abort has no committed execution; retry only with the same key when the server proves safe. Any uncertain commit state is `RECONCILIATION_REQUIRED`. | **APPROVED by user — domain/API decision**; Engineering/Security/Database verification remains outstanding |
| OAS-013 | Return 404 for nonexistent or cross-tenant/non-disclosable resources; return 403 when same-tenant existence may be disclosed but actor lacks permission. Apply consistently to resource endpoints and reconciliation. | **APPROVED by user — domain/API decision**; Security verification remains outstanding |

## Contract defects found in the final-readiness review

These are specification-level findings, not parser errors:

1. **Approval input trusts caller-supplied evaluated versions.** Corrected in candidate YAML: `ApprovalInput.expected_versions` is an optimistic precondition; response `Approval.evaluated_versions` is server-computed. Verify behavior and exact schemas in independent review.
2. **Seller instruction overlaps approval taxonomy.** Corrected in candidate YAML: `SELLER_RELEASE` removed from `ApprovalType`; seller instruction remains a separate mandatory append-only act. A separate change command records supersession/withdrawal.
3. **Approval timestamps are semantically incorrect for rejection.** Corrected in candidate YAML: `decided_at`; status `ACCEPTED`/`REJECTED`; `expires_at` is server-set for accepted approvals after the final required approval.
4. **Execution lookup had an unreachable state.** Candidate YAML selects a typed `NOT_STARTED` lookup response when no attempt exists for the authenticated tenant/operation/key; 404 is reserved for non-disclosable keys/resources.
5. **Execution failure semantics.** Candidate YAML constrains `FAILED` to a durable terminal record proving no goods-release commit; pre-commit abort has no execution resource; uncertain state remains reconcilable by original key.
6. **Suspension endpoint combined submission and verification.** Corrected in candidate YAML with distinct `/clearance-submissions` and `/clearance-verifications` operations and separate request schemas; server must enforce maker-checker.
7. **Error responses are not uniformly declared.** Review all operations for consistent 400/401/403/404/409/422/423/429/500/503 coverage where applicable and ensure every response has a schema.
8. **Authorization expiry semantics.** Candidate YAML states expiry is server-calculated under the active authorization policy and records invalidation time/reason on material authoritative source-version changes. Exact TTL remains a policy/configuration input and is not invented here.
9. **Idempotency lookup and tenant disclosure need one normative rule.** Define same-key lookup scope, actor authorization, and 403/404 behavior without allowing cross-tenant key probing.
10. **Atomic audit statement.** Candidate YAML defines the durable transaction boundary as goods-release state + authorization consumption + audit/outbox record; external audit delivery may be asynchronous.

## Required approvals before final schema freeze

- Product/API owner: OAS-001.
- Security owner: OAS-002, OAS-013 and maker-checker design OAS-011.
- Business owner and Legal: OAS-003, OAS-010.
- Domain owner: OAS-007.
- Engineering, Security and Database: OAS-008, OAS-012.
- Independent Database, Security, Legal, Finance and Syariah reviewers: review the complete contract and cross-domain invariants.

## Independent review and remaining contract verification

The user's seven domain/API decisions are recorded as approved by the user; this does not substitute for independent Legal, Security, Database, Finance, Syariah, or Engineering review. No independent reviewer sign-off is evidenced in PR #131 at this update. The following remain mandatory and cannot be self-certified by the author of this change:

- Security: authorization, tenant disclosure, idempotency key scope, maker-checker and veto authority.
- Database/Engineering: atomic release/authorization/audit-outbox commit, concurrency, retry and reconciliation semantics.
- Legal: seller instruction change rights, party approval conditions, contract and jurisdiction mapping.
- Finance and Syariah: payment/guarantee/evidence gate mapping and release constraints.
- Domain/Product: transaction-scope register authority, versioning and bilateral/protective event invariants.

Automated lint/bundle validation must be rerun against the final PR head after this report update. Review the full OpenAPI contract including every operation's applicable 400/401/403/404/409/422/423/429/500/503 response coverage and schema. Structural validation alone is not semantic sign-off.

## Freeze decision

**NOT READY TO FREEZE.** The seven user decisions are approved and candidate schema corrections are applied, but independent reviewer evidence and final-head CI are still required. Domain Service Design remains blocked until the schema freeze decision is separately approved after those gates pass.
