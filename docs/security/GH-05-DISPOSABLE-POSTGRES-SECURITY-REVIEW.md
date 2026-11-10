# GH-05 Disposable PostgreSQL Security Evidence Review

**Review date:** 2026-11-10  
**Candidate branch:** `review/p0-domain-schema-readonly-2026-11-10`  
**Latest tested SHA:** `1ea10b53a6579a135daff15ed72e2d7570a0a2dc`  
**Workflow run:** [42801375796](https://github.com/muchlisbstg/export-client-mobile-sync/actions/runs/42801375796)  
**PostgreSQL:** 16.10  
**Environment:** Disposable GitHub Actions PostgreSQL service only

## Decision

**GH-05 disposable RLS suite: PASS — 34/34, 0 failures.**  
**GH-06 synthetic parity embedded in the same run: 25 relational + 4 temporal PASS.**  
**Overall security sign-off / schema freeze: NOT APPROVED.**  
**RLS-016 / DEC-006 production identity provenance: BLOCKED.**

## Evidence reviewed

- Run 42801375796; conclusion success; exact tested SHA `1ea10b53a6579a135daff15ed72e2d7570a0a2dc`.
- Fixture initialization exit code 0.
- RLS suite: 34 passed, 0 failed.
- Relational parity: 25 passed, 0 failed.
- Temporal/concurrency parity: 4 passed, 0 failed.
- Artifact ID: `13756801226`; SHA-256: `7cd59a0e886f021f61526bda22f5a66f4a4cbb293cd098ec45e522a2f3479347`.
- RLS SQL SHA-256: `72dd4bf86fd660d7584462ec38e554baed3360f3d95cdb0c58acfa46f0fa1443`.
- RLS runner SHA-256: `e1d96398dbf0e68b7c34aecfc4c75a0e8de91e388d40c0003e287500d1ebbd08`.

## Security finding discovered and remediated

### SEC-GH05-04 — Self-enrollment through membership INSERT

Earlier fixture grants allowed `app_api` to INSERT membership rows under a policy whose WITH CHECK matched the session user. This allowed a potential self-enrollment attempt in a known tenant. The earlier test only attempted to create membership for another user and missed the self-enrollment path.

**Remediation:** `app_api` now has SELECT-only access to `tenant_memberships`. Membership lifecycle writes are reserved for a separately authorized service boundary.

**Regression tests:** RLS-033 self-enrollment, RLS-034 self-reactivation after revocation, RLS-035 membership delete/revoke. All three pass in run 42801375796.

## Other verified fixture controls

- RLS-001–015 and RLS-017–035: all reported PASS.
- app_api is NOSUPERUSER, NOBYPASSRLS and NOCREATEROLE.
- Ordinary app_api cannot write assignment-action mappings (RLS-029–031).
- Ordinary app_api cannot update/delete audit history (RLS-017, RLS-032).
- Forged membership, participant and site-link inserts are rejected (RLS-019–021).

## Remaining security blockers

1. Custom GUCs `app.tenant_id` and `app.user_id` remain settable by a SQL-capable `app_api` session. Transaction-local context prevents accidental pool leakage; it is not a cryptographic identity assertion and does not defend against arbitrary SQL under that role.
2. GH-09 run [42800442353](https://github.com/muchlisbstg/export-client-mobile-sync/actions/runs/42800442353) reports 13 PASS, 0 FAIL, 1 BLOCKED. It invokes the repository's actual `createSupabaseAuth` middleware but uses a mocked identity-provider fetcher and a test-only Express adapter. It does not validate live Supabase JWT signatures, issuer/audience, key rotation or production API-to-PostgreSQL composition.
3. The GH-09 membership resolver uses a privileged fixture connection, not a production least-privilege resolver.
4. POOL-01 uses a single-connection pool. Multi-connection saturation, cancellation, failover and production pool lifecycle remain untested.
5. The synthetic schema does not prove full physical production tables/views/partitions/functions, ownership, SECURITY DEFINER paths or actual production grants.

## Required next gates

- DB-01: reconcile migration history, full physical schema, ownership and grants.
- SEC-01: inspect actual production roles, grants, RLS policies, views and functions.
- AUTH-01 / GH-09: integrate verified identity and active-membership resolution in the authoritative API.
- POOL-01: test real production pool lifecycle across multiple connections and cancellation.
- GH-06: apply the passing 29-case synthetic corpus to full canonical DDL and reconcile all engine differences.
- Independent Security and Database reviewer sign-off.

No migration was created/applied. No staging/production database was modified. No Web/Mobile/Desktop application was connected. No merge or deployment was performed.
