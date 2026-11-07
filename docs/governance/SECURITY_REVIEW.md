# Security & Endpoint Authorization Review

**Gate:** Mandatory for every API endpoint and every material authorization change.

## Required authorization dimensions

Review each endpoint by HTTP method and route, including:
- authentication state and token validation;
- single-enterprise context and server-side enterprise boundary;
- role and permission;
- site/location scope;
- object ownership and transaction relationship;
- read, create, update, delete, export, and administrative actions;
- field-level access and sensitive document access;
- state-transition authority and audit logging.

Do not assume that hiding a UI action enforces authorization. The backend is authoritative.

## Required endpoint authorization matrix

Maintain one row per method/route and relevant resource/action.

| Method | Route | Auth required | Role(s) | Enterprise scope | Site/object scope | Data/action | Negative tests | Reviewer/status |
|---|---|---|---|---|---|---|---|---|
| TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | NOT_STARTED |

Populate from actual route registration and middleware, not only README or API documentation. Record route aliases and dynamically registered routes.

## Mandatory negative and regression tests

At minimum, test:
1. missing token;
2. malformed, expired, revoked, or wrong-audience token where applicable;
3. authenticated user with insufficient role;
4. wrong enterprise context;
5. cross-site access;
6. object-ID substitution / IDOR;
7. access to another party's transaction or document;
8. forbidden state transition;
9. privilege escalation and role assignment boundaries;
10. unauthorized list, search, export, and bulk operations.

Verify both read and mutation paths. Include positive tests to prove authorized workflows still work.

## Review deliverables

- Complete endpoint authorization matrix.
- Route-to-middleware and route-to-policy mapping.
- Findings with severity, exploit preconditions, impact, affected endpoints, remediation, and regression test.
- Test output and CI run tied to candidate commit SHA.
- Independent Security Review decision, reviewer identity, timestamp, and unresolved risks.

## Approval criteria

Security is `APPROVED` only when all in-scope endpoints are mapped, mandatory negative tests pass, high-risk findings are resolved or explicitly risk-accepted by an authorized human, and independent review evidence is recorded.

A successful CI run alone is not Security approval. Any new or changed endpoint reopens the relevant review.
