# Company Engineering Governance

These rules apply to every AI agent and contributor working in this repository. They supplement, and do not replace, repository-specific engineering instructions.

## Non-negotiable controls

1. **Evidence first.** Identify repository, branch, commit SHA, changed files, test evidence, and CI run before making status claims. Never infer that a check passed.
2. **Branch isolation.** Work on a dedicated feature/fix/governance branch. Do not write directly to `main`.
3. **No autonomous release actions.** Never merge, deploy, publish, release, apply database migrations, or change repository security settings automatically. A human must explicitly authorize each consequential action.
4. **Security review.** Every API endpoint must be represented in an authorization matrix and reviewed for authentication, enterprise boundary, role, site, object ownership, and read/write scope. Include negative tests.
5. **Database gate.** Do not create or apply a migration until the actual target schema has been inspected and reconciled against source models, migration history, constraints, indexes, and foreign keys. Require independent Database Review.
6. **Platform separation.** Validate Android, iOS, and Web independently. A pass on one platform is not evidence for another.
7. **Legal and Sharia gate.** Do not activate financial transaction flows until the actual akad, parties, ownership, money flow, fees, settlement, refund, and relevant jurisdictional requirements have been reviewed and approved by qualified human reviewers.
8. **Human approval.** AI agents may prepare changes and evidence but may not approve their own work or bypass a gate.

## Required workflow

Discovery → specification/ADR → dependency-aware tickets → isolated branch implementation → tests → independent reviews → documented human approval → manual merge → separately authorized deployment.

## Required evidence

For every change, record:
- repository, branch, base SHA, and candidate SHA;
- scope and changed files;
- test commands and actual results;
- relevant CI run and commit association;
- security/database/platform/compliance review status;
- unresolved findings, exceptions, owner, and expiry;
- explicit human approval where required.

## Gate semantics

Use only `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `FAILED`, or `APPROVED`. `APPROVED` requires named human reviewer, evidence, and timestamp. A green CI check does not imply Security, Database, Legal, or Sharia approval.

## Safety defaults

- Use synthetic or sanitized data outside approved production operations.
- Never expose secrets in source, logs, client bundles, issue comments, or agent output.
- Treat all client-supplied role, enterprise, site, ownership, payment, and settlement claims as untrusted.
- If a requirement, schema, permission, or compliance decision is ambiguous, stop and request clarification rather than guessing.
