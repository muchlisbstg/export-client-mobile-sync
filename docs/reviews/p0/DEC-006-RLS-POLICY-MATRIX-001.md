# DEC-006-RLS-POLICY-MATRIX-001

**Status:** ACCEPTED AS LOGICAL POLICY DESIGN — NOT IMPLEMENTED / NOT EXECUTED
**Date:** 2026-11-10
**Repository:** muchlisbstg/export-client-mobile-sync
**Branch:** review/p0-domain-schema-readonly-2026-11-10
**Authority:** Approved DEC-001–DEC-005 multi-tenant domain baseline
**Boundary:** No DDL, policy deployment, role mutation, migration, or live database access authorized.

## 1. Acceptance decision

The RLS policy matrix is accepted as the normative logical design baseline for DEC-006. This acceptance is limited to policy intent, table coverage, fail-closed predicates, role separation, and negative-test requirements. It is **not** approval of executable SQL, deployed policies, privilege grants, or schema freeze.

PostgreSQL is the authoritative shared transaction database. SQLite remains untrusted local/offline persistence and cannot provide final cross-tenant authorization.

## 2. Tenant-owned and related table matrix

| Table | Classification | Required RLS scope |
|---|---|---|
| tenants | Tenant root | Current authenticated tenant; cross-tenant administration only via separately authorized privileged path |
| tenant_memberships | Tenant identity | Current tenant; self-membership visibility or explicit membership-admin action |
| tenant_legal_party_bindings | Tenant legal binding | Current tenant; legal-binding administration only; historical identity/evidence protected |
| commercial_transactions | Multi-party transaction | Tenant must have an eligible participant on the transaction |
| transaction_participants | Tenant + transaction | Participant tenant and transaction tuple must match trusted context |
| supply_sites | Tenant-owned asset | Owning tenant only |
| transaction_site_links | Tenant + participant + site | Exact tenant/transaction/participant/site tuple; active scope checked by backend |
| transaction_access_assignments | Tenant + membership + site-link | Membership, participant, exact site-link and tenant tuple must match |
| transaction_access_assignment_actions | Assignment child | Access only through an authorized parent assignment |
| audit_events | Tenant/security history | Tenant/transaction-scoped read; controlled append; ordinary application UPDATE/DELETE denied |
| legal_parties | Global legal identity | No broad tenant visibility; access limited to legal parties referenced by authorized bindings/transactions |
| permission_actions | Shared controlled catalog | Read-only to application roles; writes reserved for governance/migration role |

Every additional tenant-owned table discovered in the physical schema must be added to this matrix before DEC-006 closure. Views, materialized views, partitions, functions and indirect joins must not create an RLS bypass.

## 3. Trusted context contract

- user_id comes from server-verified authentication, never from a client-supplied identifier alone.
- tenant_id is resolved through an active tenant_memberships row.
- membership_id is stable and tenant-bound; revoked/expired membership denies access.
- transaction_id requires a valid participant for the current tenant.
- participant_id must match tenant and transaction and be in an allowed lifecycle state.
- site_id requires an exact active transaction_site_links relationship for that participant and transaction.
- action_code must be active in the canonical action catalog and explicitly granted to the assignment.
- Role membership does not imply contract approval, payment/ledger authority, custody, or goods release.
- Missing, stale, malformed, conflicting or unverifiable context fails closed.

Context must be established server-side within a database transaction using transaction-local state. Connection-pool reuse must not carry tenant context across requests. Backend authorization remains mandatory even when RLS is active.

## 4. Role and privilege boundary

| Role | Required boundary |
|---|---|
| API application role | Non-superuser, not table owner, no BYPASSRLS; least-privilege DML; RLS applies |
| Worker role | Separate identity and narrowly scoped job permissions; no default cross-tenant access |
| Migration role | Separate controlled deployment identity; not used by API requests |
| Table owner | Not used by application runtime; FORCE ROW LEVEL SECURITY evaluated |
| Superuser/break-glass | Operationally restricted, audited, never used for ordinary application requests |

For each tenant-owned table, closure evidence must show ENABLE ROW LEVEL SECURITY, the reviewed FORCE decision, policy expressions, grants, role attributes and actual session role. RLS policies must cover SELECT, INSERT, UPDATE and DELETE according to the table's lifecycle contract.

## 5. Negative-access acceptance corpus

| ID | Attack / invalid context | Expected result |
|---|---|---|
| RLS-001 | Tenant A selects Tenant B row by guessed ID | No row visible / DENY |
| RLS-002 | Tenant A reads transaction without its participant | No row visible / DENY |
| RLS-003 | Client substitutes tenant B in request payload | DENY |
| RLS-004 | Revoked membership accesses tenant data | DENY |
| RLS-005 | Pending/suspended/revoked participant accesses transaction | DENY |
| RLS-006 | Supplier accesses a site without exact active site-link | DENY |
| RLS-007 | Assignment membership belongs to another tenant | FK/RLS rejection |
| RLS-008 | Assignment site differs from exact site-link tuple | FK/RLS rejection |
| RLS-009 | Action absent, deprecated or outside grant | DENY |
| RLS-010 | Supplier attempts contract approval | DENY |
| RLS-011 | Supplier attempts payment approval or ledger mutation | DENY |
| RLS-012 | Supplier attempts goods release | DENY |
| RLS-013 | Cross-tenant audit read through join/view | No row visible / DENY |
| RLS-014 | Tenant context missing | DENY |
| RLS-015 | Pooled connection reused across tenants | No context leakage |
| RLS-016 | Client attempts to elevate/change server context | DENY |
| RLS-017 | Ordinary application role updates/deletes audit history | DENY |
| RLS-018 | Subquery, view, function or indirect join bypasses tenant boundary | DENY |

Tests must run against disposable PostgreSQL using the actual non-bypass API role, not the schema owner. Include SELECT/INSERT/UPDATE/DELETE, transaction rollback, pool reuse and view/function paths. Verify both row visibility and write rejection.

## 6. Closure evidence required

- Complete physical table/view/function/partition inventory.
- Policy SQL and exact schema migration SHA.
- Role attributes, grants, ownership and FORCE RLS evidence.
- Server-side context establishment and pool-reset evidence.
- Negative-test logs for RLS-001–018 on disposable PostgreSQL.
- Cross-check against DEC-001–005 and participant/site/action scope.
- Reviewer sign-off and exact tested commit SHA.

## 7. Current status

**Design accepted. DEC-006 remains OPEN until executable policy, role configuration and negative-access evidence are reviewed.** This document does not authorize implementation or database mutation.
