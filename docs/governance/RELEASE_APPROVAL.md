# Release Readiness & Human Approval

**Policy:** No automatic merge, deployment, migration, release, publication, or protected-branch write.

## Standard workflow

Implementation on isolated branch → automated tests → pull request → independent reviews → documented human approval → manual merge → separately authorized deployment.

## Prohibited agent actions

Unless the user explicitly authorizes a specific action, agents must not:
- merge or enable auto-merge;
- push directly to `main` or another protected branch;
- deploy, publish, or release;
- apply database migrations to shared environments;
- change branch protection, repository visibility, permissions, or secrets;
- approve their own PR or mark their own independent review gate approved.

A request to prepare a PR does not authorize merging it. A request to prepare a migration does not authorize applying it.

## Release evidence checklist

- [ ] Candidate repository, branch, and exact commit SHA recorded.
- [ ] CI checks are complete and tied to that candidate SHA.
- [ ] Endpoint authorization matrix complete and Security Review approved.
- [ ] Schema reconciliation and Database Review approved; migration approval separately recorded if applicable.
- [ ] Android validation approved.
- [ ] iOS validation approved.
- [ ] Web validation approved.
- [ ] Legal review approved where applicable.
- [ ] Sharia review approved where applicable.
- [ ] Regression and operational readiness evidence recorded.
- [ ] Outstanding risks, exceptions, owners, and expiry documented.
- [ ] Human release owner explicitly approves the next action.

## Status rules

- `NOT_STARTED`: no work/evidence yet.
- `IN_PROGRESS`: work underway; not a pass.
- `BLOCKED`: prerequisite or approval missing.
- `FAILED`: evidence shows acceptance criteria are not met.
- `APPROVED`: named authorized human reviewer, evidence, and timestamp recorded.

Do not calculate an overall release pass by averaging gate results. Every applicable mandatory gate must be approved. CI green is necessary where required, but never sufficient for security, database, legal, Sharia, or release approval.
