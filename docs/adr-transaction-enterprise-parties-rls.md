# ADR: Transaction enterprise-party bridge, composite integrity, and RLS

- **Status:** Proposed — requires Security and Database approval.
- **Baseline:** `cf773250492c669b3fe5da2bbc4f6f4d4c594f87`.
- **Decision scope:** schema design only. No PostgreSQL migration file is included or authorized by this ADR.

## 1. Context and invariants

A commercial transaction has exactly one buyer tenant and one seller tenant, and they must differ. Authorization assignments and site links must never reference a tenant that is not a party to that transaction. A site reference must belong to the same tenant as the assignment/site link. These invariants must be enforced by PostgreSQL constraints, not only application code.

The current SQLite migration creates single-column references to tenant and transaction separately. Those constraints do not prove the tenant/transaction tuple is valid. The read-only schema inspector therefore reports five blockers.

## 2. Proposed transaction_enterprise_parties model

Proposed logical shape:

| Column | Type | Rule |
|---|---|---|
| tenant_id | uuid | NOT NULL; FK tenants(id) |
| transaction_id | uuid | NOT NULL; FK commercial_transactions(id) |
| party_role | text | NOT NULL; CHECK buyer/seller |
| created_at | timestamptz | NOT NULL DEFAULT now() |
| created_by | uuid | nullable actor reference per identity model |

Keys:
- PRIMARY KEY (tenant_id, transaction_id)
- UNIQUE (transaction_id, party_role)
- Optional reverse index on (transaction_id, tenant_id)

A row is valid only when:
- party_role = 'buyer' AND tenant_id = commercial_transactions.buyer_tenant_id; OR
- party_role = 'seller' AND tenant_id = commercial_transactions.seller_tenant_id.

**Enforcement choice proposed:** a narrowly scoped PostgreSQL constraint trigger (BEFORE INSERT OR UPDATE) that loads the referenced transaction and enforces the party-role/tenant equality. It must raise SQLSTATE 23514 on mismatch. The trigger function should be schema-qualified, use a fixed safe search_path, and not be SECURITY DEFINER unless Security explicitly approves a documented need. The transaction row should be locked sufficiently to avoid a concurrent party-ID update race. An alternative declarative design may be proposed by Database review, but the invariant must be database-enforced.

Why not a plain CHECK: PostgreSQL CHECK constraints cannot safely enforce cross-table conditions. Why not trust application code: direct SQL, future services, and concurrency can bypass it.

## 3. Composite FK contract

Required unique keys:
- commercial_transactions: UNIQUE (id, buyer_tenant_id) and UNIQUE (id, seller_tenant_id), if needed by the chosen declarative alternative.
- transaction_enterprise_parties: PRIMARY KEY (tenant_id, transaction_id).
- supply_sites: UNIQUE (tenant_id, id).

Required references:
- transaction_access_assignments (tenant_id, transaction_id) -> transaction_enterprise_parties (tenant_id, transaction_id).
- transaction_site_links (tenant_id, transaction_id) -> transaction_enterprise_parties (tenant_id, transaction_id).
- transaction_access_assignments (tenant_id, site_id) -> supply_sites (tenant_id, id). Keep site_id nullable only for buyer, seller, and auditor scopes; enforce role/site nullability with a CHECK constraint.
- transaction_site_links (tenant_id, site_id) -> supply_sites (tenant_id, id), with both columns NOT NULL.

Use ON DELETE RESTRICT for tenant/transaction/site ownership references unless Database review explicitly approves a lifecycle cascade. Revocation should be status-based and auditable; deleting a tenant, transaction, or site must not silently erase the authorization trail.

## 4. Backfill and consistency strategy

No existing operational rows may be auto-classified from guesses. For every existing commercial transaction:
1. Create exactly two party bridge rows from its authoritative buyer_tenant_id and seller_tenant_id.
2. Validate tenant existence, distinct buyer/seller, and party-role consistency.
3. Quarantine or report invalid rows; do not silently discard or rewrite them.
4. Validate every assignment and site link against the bridge and same-tenant site key.
5. Require zero orphan/mismatch rows before adding validated constraints.
6. Do not import `api.sqlite` operational data into staging or fixtures. Use synthetic fixtures only.

A future migration must be additive, transactionally safe, idempotence strategy documented, lock impact estimated, and accompanied by a rollback/forward-fix plan. If rollback would lose authorization evidence, prefer forward-fix over destructive down migration.

## 5. RLS policy strategy

RLS is defense in depth; API middleware remains mandatory. No authorization decision may use user-editable `user_metadata` / `raw_user_meta_data`. Membership and role facts must come from authoritative tables or server-controlled app metadata with explicit freshness handling.

Proposed policy model, subject to schema exposure review:
- Enable RLS on all tables in exposed schemas; evaluate FORCE ROW LEVEL SECURITY for owner-access paths.
- `transaction_enterprise_parties`: authenticated SELECT only when `auth.uid()` has an active membership in `tenant_id`; no direct client writes.
- `transaction_access_assignments`: SELECT only for active tenant members, further scoped to the caller's own assignment unless the caller has active enterprise_admin; INSERT/UPDATE/DELETE restricted to enterprise_admin and validated against active role + party + site membership.
- `transaction_site_links`: SELECT only for active tenant members with applicable transaction/site visibility; writes restricted to enterprise_admin.
- Use `TO authenticated` plus explicit predicates. Do not treat `TO authenticated` alone as authorization.
- UPDATE policies must have both USING and WITH CHECK.
- Avoid SECURITY DEFINER. If an unavoidable helper is proposed, keep it outside exposed schemas, restrict EXECUTE grants, pin search_path, validate auth.uid() in-body, and document bypass-RLS implications.
- Do not grant anon access. Prefer no direct Data API exposure for internal authorization tables; if authenticated grants are needed, grant only required operations and keep RLS enabled.
- Views, if any, must use security_invoker where supported and be independently reviewed.

RLS test matrix must include anonymous, authenticated non-member, active member, suspended/revoked member, admin, buyer, seller, supplier, warehouse, QC, logistics, auditor, cross-tenant row access, UPDATE tenant reassignment, and direct INSERT/DELETE attempts.

## 6. Required PostgreSQL verification

Run only against an isolated disposable PostgreSQL test database after this design is approved:
- Catalog inspection for exact constraints, indexes, triggers, and RLS flags.
- Positive buyer and seller bridge inserts.
- Negative non-party tenant, wrong party_role, duplicate party role, tenant mismatch, cross-tenant site FK, and nullability violations.
- RLS tests under anon/authenticated roles with real JWT subject claims.
- Verify UPDATE cannot move a row to another tenant (USING + WITH CHECK).
- Verify application service identity does not leak a service_role key to clients.
- Run Supabase advisors and review grants, policies, views, functions, and trigger search_path.
- Capture schema diff, query plans/lock impact, test output, and rollback/forward-fix evidence.

## 7. Gate and sequencing

1. Security and Database reviewers approve this ADR and the endpoint matrix.
2. Only then create a PostgreSQL migration candidate on a separate branch; do not apply it to staging.
3. Execute migration candidate in disposable local PostgreSQL and run constraint/RLS tests.
4. Review migration SQL, backfill, privileges, RLS, rollback, and operational impact.
5. Close P0 Security and P0 Schema only after independent approvals and reproducible CI evidence.
6. Only after both P0 gates close may Migration Review begin, then Functional E2E.

**Current decision:** design not yet approved. No PostgreSQL migration candidate is generated or applied. Staging remains untouched.
