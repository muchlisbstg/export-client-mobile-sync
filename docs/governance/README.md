# Company Engineering Governance Overlay

**Status:** Proposed repository policy; adoption requires human review.  
**Applies to:** Engineering work, AI agents, CI workflows, and release preparation for this project.

This overlay adapts the Matt Pocock Skills workflow to company-level controls. It does not modify or vendor upstream skill source. Upstream skills remain reusable engineering procedures; this repository's governance documents define mandatory company gates.

## Policy set

| Policy | Mandatory evidence | Blocking condition |
|---|---|---|
| [Security & Authorization](SECURITY_REVIEW.md) | Endpoint authorization matrix, negative tests, independent review | Unmapped endpoint, authorization gap, or unreviewed finding |
| [Database Schema & Migration](DATABASE_MIGRATION.md) | Actual schema inventory, reconciliation report, isolated migration test, Database Review | Schema drift unresolved or approval absent |
| [Expo Platform Validation](EXPO_PLATFORM_VALIDATION.md) | Separate Android, iOS, and Web evidence | Any target untested or failing |
| [Legal & Sharia](LEGAL_SHARIA_REVIEW.md) | Transaction specification and documented qualified reviews | Financial flow lacks applicable approval |
| [Release & Human Approval](RELEASE_APPROVAL.md) | Candidate SHA, CI evidence, review records, explicit approval | Any applicable gate pending or failed |

## Mapping to Matt Pocock Skills

| Skill/workflow | Company control |
|---|---|
| `/grill-with-docs` | Capture domain constraints, threat assumptions, schema assumptions, ADRs, and Legal/Sharia questions |
| `/to-spec` | Include endpoint-level authorization, migration preconditions, platform acceptance criteria, and compliance gates |
| `/to-tickets` | Represent review gates as dependencies; do not mark blocked work ready |
| `/implement` | Isolated branch, TDD, synthetic data, no automatic merge/deploy/migration |
| `/code-review` | Add independent Security and Database review; code review does not replace either |
| `/diagnosing-bugs` | Reproduce, isolate, record evidence, add regression tests |
| `/improve-codebase-architecture` | Architecture survey first; implementation requires a separately approved scope |
| `/pr` | Summarize candidate SHA, evidence, outstanding risks, and approvals; never merge |

## Project-specific baseline

The product README describes an MVP/development system and explicitly says it is not evidence of production security or regulatory readiness. Continue using synthetic/demo data until the applicable gates have passed. Treat roadmap items as requirements, not proof of implementation.

## Change control

Policy changes require a reviewed pull request. No policy author or AI agent may self-approve a mandatory gate. Exceptions must identify scope, rationale, risk owner, compensating controls, approver, and expiry; legal or Sharia approval cannot be waived by an engineering exception.
