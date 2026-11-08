# OpenAPI 3.1 — Final Review Readiness & Decision Register

**Review target:** PR #131, branch `docs/p0-001-release-authorization-openapi-2026-11-08`
**Reviewed head:** `4444772f44c9c08f2e6e7bad54ff1c7d6f15ad96`
**Specification blob:** `bf18f16b6dbdbc590cba43671f5632a8bf733b75`
**Review outcome:** NOT READY TO FREEZE
**Scope:** Contract semantics and governance review only. No DDL, migration, application implementation, merge, or deployment.

## Executive result

The OpenAPI 3.1 document passes the recorded Redocly lint and bundle/reference-resolution workflow. That validates syntax and structural consistency; it does not establish business-policy approval, complete response semantics, authorization enforcement, or implementation correctness.

No PR reviews or inline review threads were present at the time of this review. Independent Database, Security, Legal, Finance, and Syariah sign-offs are not evidenced.

## OAS-001 through OAS-013 decision register

| ID | Proposed resolution | Approval status / owner |
|---|---|---|
| OAS-001 | Retain `GET /release-authorizations/requests` as a read-only, tenant-scoped paginated collection. Apply server-side membership and row-level authorization; never accept tenant identity from the caller. | Product/API owner approval required |
| OAS-002 | Treat OpenAPI BearerAuth as authentication documentation only. All roles, party authority, site/transaction assignment, separation-of-duties and veto permissions must be enforced server-side; vendor extensions are not enforcement. | Security owner sign-off required |
| OAS-003 | Preserve the frozen matrix: seller release instruction is mandatory; buyer approval is conditional on signed contract/applicable law. No additional party approval is mandatory unless the signed contract or applicable law requires it. Do not imply a generic extra party approval by default. | Business owner confirmation; Legal review for contract/law mapping |
| OAS-004 | Keep veto and suspension as separate records, lifecycle transitions, audit events and clearance decisions. Clearance of either is not release authorization. | Design resolution incorporated; Security/domain review required |
| OAS-005 | Retain reconciliation by the original idempotency key. Same tenant + operation + key + canonical payload hash returns the prior result; same key with a different payload returns 409. A timeout never authorizes a new key or blind duplicate execution. | Design resolution incorporated; Engineering/Security review required |
| OAS-006 | Approval validity is 24 hours from the final required approval; timestamps and expiry are server-calculated. Material changes invalidate affected approvals; no restoration of invalidated approvals. | User-approved policy decision; ensure schema represents it without client control |
| OAS-007 | Recommended authority: a server-owned, append-only transaction-scope decision/version record linked to contract and signed contract snapshot. Its current state is derived only from valid bilateral activation/reactivation or permitted protective suspension/withdrawal events. Release evaluation consumes its version and status. | Domain owner approval required; confirm whether this is the intended authoritative scope register |
| OAS-008 | Require a durable atomic boundary for goods-release state change, authorization consumption, and an audit/outbox event. If external audit export is asynchronous, the outbox record must commit in the same transaction; never report committed release before that durable commit. | Engineering + Security + Database review required |
| OAS-009 | Keep `NOT_APPLICABLE` server-policy-engine-only. The client cannot submit or override gate applicability. | Design resolution incorporated; policy-engine tests required |
| OAS-010 | Recommended: make seller instructions append-only. Permit the authorized Seller to supersede/withdraw an instruction before execution; record actor, reason and timestamp. Any change invalidates dependent approvals and active authorization. After execution, correction is a compensating/audit event, never deletion. | Business owner + Legal approval required |
| OAS-011 | Recommended: split suspension clearance into separate submit and verify commands/endpoints. Enforce maker-checker: submitter cannot verify own clearance; only the authorized owner of the underlying hold can verify/reject. | Security + domain owner approval required |
| OAS-012 | Define `FAILED` only for a durable, terminal, recorded execution outcome with proof that goods release did not commit. A pre-commit abort has no committed execution; retain idempotency attempt state and permit retry only with the same key when server proves safe. Any uncertain commit state is `RECONCILIATION_REQUIRED`. | Engineering + Security + Database approval required |
| OAS-013 | Recommended disclosure policy: return 404 for nonexistent or cross-tenant/non-disclosable resources; return 403 when the resource is in the caller's tenant and existence may be disclosed but the actor lacks the required permission. Apply consistently to all resource endpoints. | Security owner approval required |

## Contract defects found in the final-readiness review

These are specification-level findings, not parser errors:

1. **Approval input trusts caller-supplied evaluated versions.** Rename to `expected_versions` and define server-side comparison against authoritative current versions. The server must calculate actual versions; client values are only optimistic preconditions.
2. **Seller instruction overlaps approval taxonomy.** The required seller instruction is a separate mandatory command. Do not also model `SELLER_RELEASE` as a second party approval unless the policy owner explicitly intends two distinct acts.
3. **Approval timestamps are semantically incorrect for rejection.** `approved_at` should become `decided_at`; expiry applies to accepted approvals and is assigned when the final required approval is recorded.
4. **Execution lookup has an unreachable state.** It lists `NOT_STARTED` but documents 404 for no record. Choose one consistent contract: return a typed `NOT_STARTED` lookup response with same-key retry guidance, or remove that state and define 404 semantics precisely.
5. **Execution failure semantics are underspecified.** `ReleaseExecution` currently permits `FAILED` but the durable terminal condition, retry semantics and relationship to pre-commit abort need OAS-012 resolution.
6. **Suspension endpoint combines submission and verification actions.** The action enum does not itself enforce maker-checker; separate commands are recommended under OAS-011.
7. **Error responses are not uniformly declared.** Review all operations for consistent 400/401/403/404/409/422/423/429/500/503 coverage where applicable and ensure every response has a schema.
8. **Authorization expiry semantics are not explicit.** Define whether authorization has a separate short-lived expiry, its server-side calculation, and invalidation on any material source-version change.
9. **Idempotency lookup and tenant disclosure need one normative rule.** Define same-key lookup scope, actor authorization, and 403/404 behavior without allowing cross-tenant key probing.
10. **Atomic audit statement needs a precise commit definition.** The API must not imply an external audit sink is in the same database transaction; use a transactional outbox boundary if external delivery is asynchronous.

## Required approvals before final schema freeze

- Product/API owner: OAS-001.
- Security owner: OAS-002, OAS-013 and maker-checker design OAS-011.
- Business owner and Legal: OAS-003, OAS-010.
- Domain owner: OAS-007.
- Engineering, Security and Database: OAS-008, OAS-012.
- Independent Database, Security, Legal, Finance and Syariah reviewers: review the complete contract and cross-domain invariants.

## Freeze decision

**Do not freeze this schema yet.** The validator pass remains valid for the previously tested candidate, but this review found semantic contract issues and unresolved approvals. Resolve the approval register, apply the approved contract corrections, rerun OpenAPI 3.1 lint and bundle validation on the exact new head SHA, and obtain independent review evidence. Only then can the schema be marked frozen and Domain Service Design begin as a separate artifact.
