# Claude Code Instructions

These instructions apply to the entire `export-client-mobile-sync` repository.

## Project context

This repository contains an Expo / React Native mobile client and a Node.js / Express API backed by SQLite. The backend can optionally replicate inquiry records with configured Web and Desktop peer backends using a persistent outbox, retries, and conflict tracking.

Read `README.md` and `DESIGN.md` before making architectural changes. Treat `DESIGN.md` as a proposal and acceptance guide, not proof that every described control is already implemented. Inspect the actual code and migrations before relying on any documented behavior.

## Non-negotiable working rules

1. **Prove before claiming.** Base conclusions on files, tests, workflow logs, and commit SHAs that you actually inspected. Clearly distinguish verified behavior, assumptions, and proposed work.
2. **Keep changes scoped.** Prefer the smallest change that addresses the demonstrated issue. Do not refactor unrelated code.
3. **Protect the main branch.** Work on a dedicated branch. Do not push directly to `main`, merge pull requests, deploy, change repository visibility, or change branch protection unless the user explicitly authorizes that exact action.
4. **No implicit approvals.** AI recommendations never replace required human review, security approval, business approval, or release gates.
5. **No real-money or production-data actions.** Do not initiate real payments, production migrations, destructive repairs, or production deployments. Use synthetic or sanitized data unless explicitly authorized and appropriately safeguarded.
6. **No fabricated completion.** Never report a test, migration, security review, CI run, commit, or deployment as successful unless the result was actually observed.
7. **Protect secrets and data.** Never print, commit, bundle, or place tokens, passwords, private keys, peer secrets, or sensitive customer data in logs, examples, screenshots, or test fixtures. Use placeholders in documentation.
8. **Avoid compliance claims.** Do not claim export/customs/legal compliance, certification, or Syariah compliance without the applicable evidence and qualified human review.

## Before changing code

- Inspect the current branch, working tree, relevant source files, migrations, tests, and recent CI evidence.
- Find the existing implementation before creating a duplicate helper, endpoint, schema, or workflow.
- Identify the expected behavior, regression risk, and acceptance test before editing.
- For database changes, inspect the current schema and migration conventions. Do not guess the live schema from names alone.
- For dependency changes, check Expo's expected versions, the package manifest, and the lockfile together.

## Mobile and API conventions

- Treat the mobile client as untrusted. Client-side validation is for user experience; the server must validate and authorize every request.
- Never put server credentials in `EXPO_PUBLIC_*` variables or in the mobile bundle.
- Keep public application routes separate from internal peer-sync routes and credentials.
- Use explicit schemas, stable error codes, bounded request sizes, and safe error responses.
- Preserve accessible labels, clear loading/empty/error/offline states, and explicit feedback when an action is pending.
- Do not present demo catalog data as verified suppliers, real inventory, or certified products.

## Tenant isolation and authorization

- Resolve tenant membership and role permissions on the server for every protected operation.
- Never trust a client-provided tenant ID, record owner, role, or authorization decision without server-side verification.
- Enforce object-level authorization on reads, writes, exports, and replication.
- Add positive same-tenant tests and negative cross-tenant, unauthenticated, forged-tenant, and role-escalation tests for protected behavior.
- Cross-tenant replication must be rejected without modifying either tenant's data.

## SQLite and data integrity

- Follow existing database and migration patterns; use transactions and constraints to protect invariants.
- A domain write and its corresponding outbox event must be atomic where the design requires both.
- Do not perform network requests while holding a database transaction open.
- Back retries with durable state so process restarts do not silently discard pending work.
- Never silently overwrite an existing record when the same stable identity arrives with different content; record and expose a conflict.
- Treat migrations as high risk: test on fresh databases and representative sanitized copies, and verify recovery behavior before proposing rollout.
- Do not delete or rewrite user data merely to make tests pass.

## Peer synchronization requirements

- Distinguish local persistence, queued delivery, per-peer acknowledgement, and convergence across required peers.
- Make inbound event handling idempotent and safe when a receiver commits but the sender loses the acknowledgement.
- Validate peer identity, authentication, payload schema/version, tenant context, and event identity on receipt.
- Use bounded retries, exponential backoff with jitter, timeouts, and visible failure states.
- Preserve enough structured metadata for debugging: event ID, peer ID, attempt count, result category, timestamp, and correlation ID. Redact secrets and sensitive payloads.
- Tests must assert final database state and outbox/inbox state, not only successful HTTP responses.
- Do not claim sync is healthy while a required peer remains unconverged or conflicts remain unresolved.

## Tests and quality gates

Use the repository's existing scripts as the source of truth. Current documented scripts include:

- `npm test` — API/server and domain test suite.
- `npm run typecheck` — TypeScript typecheck.
- `npx expo install --check` — Expo dependency compatibility check, when supported by the installed toolchain.
- `npx expo export --platform android` — Android bundle/export check, when the environment supports it.

Run the most targeted relevant tests first, then the full applicable suite. Report exact commands and outcomes. If a command cannot run because of missing dependencies, platform limitations, or environment constraints, state that explicitly.

Release candidates must also pass:
- tenant-isolation and authorization tests;
- migration and database integrity tests;
- retry, idempotency, lost-acknowledgement, and restart-recovery tests;
- Web–Mobile–Desktop interoperability/convergence tests;
- dependency compatibility and platform export checks relevant to the change.

A failed mandatory gate is a blocker. Do not skip, weaken, delete, or mask a test just to obtain a green run. If a test is flaky or incorrect, demonstrate the cause and propose a justified fix.

## CI and Git workflow

- Inspect the exact commit SHA and workflow run associated with any pass/fail claim.
- Re-run checks after the final change where tools and permissions allow.
- Keep commits focused and messages descriptive.
- Open a pull request for review when authorized; default to draft if the change is not ready.
- Do not merge a PR, deploy, or change `main` without explicit user authorization.
- When reporting completion, include branch, changed files, commit SHA, tests run, observed outcomes, and unresolved risks.

## Documentation

- Update documentation when behavior, API contracts, configuration, migration procedures, or release gates change.
- Mark planned features as planned; distinguish them from implemented features.
- Use synthetic values and placeholders in examples.
- Keep `README.md` focused on setup and project overview, `DESIGN.md` focused on architecture and acceptance criteria, and this file focused on contributor/agent operating rules.

## Definition of done

A change is done only when:
1. The intended behavior is implemented with a focused diff.
2. Relevant tests pass, or unrun/failed tests are explicitly reported.
3. Security and tenant-isolation implications are covered.
4. Documentation is updated where necessary.
5. The exact branch and commit are identified.
6. No unauthorized merge, deployment, or production action occurred.
