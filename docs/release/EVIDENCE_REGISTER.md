# Release Evidence Register

**Repository:** muchlisbstg/export-client-mobile-sync  
**Current baseline:** `main` SHA `9e02871971fde07a5e9c2271960c4e35f3c2b49d`  
**Status:** Working register; no release gate is approved by this document.

## Gate register

| Gate | Status | Evidence required | Current limitation / next action |
|---|---|---|---|
| Security P0 | BLOCKED | Complete route × method × role × enterprise × site positive/negative matrix; audit failure and revocation tests; independent Security Review | Existing PR #119 explicitly lists remaining positive-path, audit failure-injection, exhaustive revocation/site-state, browser CORS and independent review gaps. |
| Database schema | BLOCKED | Physical schema identity and schema-only reconciliation; five blocker design; isolated candidate tests; independent Database Review | Five source-level blockers remain. Existing synthetic contract test detects them; it does not implement the candidate design. |
| Android | IN_PROGRESS | Exact-SHA SDK check, test/typecheck, native APK build, emulator/device login/API regression, artifact and logs | Historical APK run is not evidence for current candidate SHA. Rerun on current PR candidate. |
| iOS | IN_PROGRESS | Exact-SHA native build, Simulator install/launch, login/API/session test, artifact and logs | Historical Simulator run is not evidence for current candidate SHA. Rerun on current PR candidate. |
| Web | IN_PROGRESS | Exact-SHA static export, browser runtime tests, routing/session/login, CORS and API integration | Static export alone does not prove browser functional validation. |
| Dependency audit | IN_PROGRESS | Fresh `npm audit` JSON + exit code + package/lock SHA + reviewed remediation | Prior audit evidence is historical; run again against candidate lockfile. |
| Legal | BLOCKED | Transaction specification and qualified jurisdiction-specific review | Financial flow remains demo/sandbox only pending review. |
| Sharia | BLOCKED | Akad, parties, ownership, possession, risk, money-flow, fees, settlement and qualified Sharia review | No engineering declaration of Sharia compliance. |
| Release approval | BLOCKED | All applicable gate approvals, candidate SHA, named release owner, timestamp | No merge, deployment, store submission, or release authorization. |

## Evidence record format

For each new evidence item, record:

- gate and acceptance criterion;
- repository, branch, exact commit SHA;
- workflow/run URL and job name;
- artifact name and immutable artifact/run identifier;
- test command, environment/runtime version, result and timestamp;
- reviewer identity, authority, decision, conditions and timestamp;
- open findings, owner, risk, mitigation and expiry.

Never copy a green check from a different commit and present it as evidence for the current candidate.

## Known historical evidence (not current-candidate approval)

Earlier documentation references CI runs from 2026-11-04 (including mobile CI, Android preview APK, iOS Simulator and Web export). Their recorded commit SHAs differ from the current `main` baseline. Treat them as historical capability evidence only; rerun all required checks against the exact candidate SHA under review.

## Release decision rule

The release state is the strictest applicable gate, not an average. Any mandatory `BLOCKED`, `FAILED`, `NOT_STARTED`, missing reviewer, or mismatched candidate SHA blocks release.
