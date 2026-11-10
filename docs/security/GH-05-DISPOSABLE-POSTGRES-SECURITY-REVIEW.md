# GH-05 Disposable PostgreSQL Security Evidence Review

**Review date:** 2026-11-10  
**Candidate branch:** `review/p0-domain-schema-readonly-2026-11-10`  
**Reviewed commit:** `55b91afa98bea46a0258db6b4ef9f7819d4c6cda`  
**Workflow run:** [42800478587](https://github.com/muchlisbstg/export-client-mobile-sync/actions/runs/42800478587)  
**PostgreSQL:** 16.10  
**Environment:** Disposable GitHub Actions PostgreSQL service only

## Decision

**GH-05 disposable RLS suite: PASS — 34/34, 0 failures.**  
**Overall security sign-off / schema freeze: NOT APPROVED.**  
**RLS-016 / DEC-006 production identity provenance: BLOCKED.**

The PASS is scoped to the synthetic RLS fixture and the tested app_api grants/policies. It is not proof that production PostgreSQL schema, production API integration, or all tenant authorization surfaces are complete.

## Evidence reviewed

- Workflow run: 42800478587; conclusion: success; tested SHA: `55b91afa98bea46a0258db6b4ef9f7819d4c6cda`.
- Fixture initialization: exit code 0.
- RLS suite: 34 passed, 0 failed.
- PostgreSQL–SQLite relational subset: 15 passed, 0 failed (separate GH-06 corpus).
- Artifact: `p0-disposable-db-gates-55b91afa98bea46a0258db6b4ef9f7819d4c6cda`, ID `13756795156`.
- PostgreSQL: 16.10; SQLite: 3.53.4.
- Manifest hashes: RLS SQL `72dd4bf86fd660d7584462ec38e554baed3360f3d95cdb0c58acfa46f0fa1443`; RLS runner `e1d96398dbf0e68b7c34aecfc4c75a0e8de91e388d40c0003e287500d1ebbd08`.

## Security finding discovered and remediated

### SEC-GH05-04 — Self-enrollment through membership INSERT

**Finding:** The earlier fixture allowed `app_api` to INSERT into `tenant_memberships`, while its `WITH CHECK` policy accepted an active membership whose `user_id` matched the session GUC. A caller able to set its own context could therefore attempt to create its own active membership in a known tenant. The earlier RLS-019 only tested inserting a membership for another user and did not detect self-enrollment.

**Remediation:** The disposable fixture now grants `app_api` SELECT-only access to `tenant_memberships`. Membership lifecycle writes are reserved for a separately authorized service boundary.

**Regression evidence:**
- RLS-033: self-enrollment into a known tenant rejected.
- RLS-034: reactivation of own revoked membership rejected.
- RLS-035: membership deletion/revocation through ordinary app_api rejected.

All three passed in run 42800478587. This closes the specific fixture-level privilege path; production grants and service boundary still require independent verification.

## Other reviewed controls

- RLS-001–015, RLS-017–035: all reported PASS.
- Ordinary app_api cannot mutate audit history (RLS-017, RLS-032).
- Ordinary app_api cannot create/update/delete assignment-action grants (RLS-029–031).
- Forged membership, participant and site-link writes are rejected (RLS-019–021).
- The role is NOSUPERUSER, NOBYPASSRLS and NOCREATEROLE.
- RLS is enabled and FORCE RLS is applied to the synthetic tenant-scoped tables.

## Remaining security blockers

### SEC-GH05-01 — Context provenance is not a database-verifiable identity assertion

The policies use `app.tenant_id` and `app.user_id` custom PostgreSQL settings. A SQL-capable `app_api` session can set these values. Transaction-local context and pool reset prevent accidental context leakage, but do not prevent arbitrary SQL running as app_api from forging them.

GH-09 has a separate disposable HTTP/API harness result: 13 PASS, 0 FAIL. It invokes the repository's `createSupabaseAuth` middleware, but the identity-provider fetcher is mocked and the harness is not the production PostgreSQL API composition. It does not validate a live Supabase JWT/signature or production API-to-PostgreSQL trust boundary.

**Required:** actual production API must derive identity from verified Supabase identity, resolve membership through a least-privilege server-side path, and establish database context without trusting client-provided values. Arbitrary SQL under app_api must either be excluded from the threat model with robust controls or the database context assertion must be redesigned.

### SEC-GH05-02 — Synthetic schema scope

This fixture is not the full canonical PostgreSQL schema. Physical table/view/partition/function inventory, ownership, SECURITY DEFINER review, and production grant reconciliation remain open.

### SEC-GH05-03 — DEC-008 parity is partial

GH-06 reports 19 synthetic parity cases passing (15 relational + 4 temporal/concurrency). It does not yet cover every canonical acceptance criterion or the complete canonical DDL. Do not close DEC-008 or approve schema freeze from these results.

## Required next gates

1. DB-01: reconcile real migration history, schema, owners and grants against the canonical specification.
2. SEC-01: inspect actual production role grants, RLS policies, views, functions and bypass paths.
3. AUTH-01 / GH-09: prove verified identity and active-membership resolution in the authoritative API composition.
4. POOL-01: extend tests beyond the single-connection synthetic harness to production pool lifecycle, cancellation and failure cases.
5. GH-06: complete canonical schema parity and every acceptance row.
6. Independent Security and Database review, with recorded reviewer identity and disposition.

## Scope guardrails

No migration was created or applied. No staging/production database was modified. No Web, Mobile or Desktop application was connected. No merge or deployment was performed.
