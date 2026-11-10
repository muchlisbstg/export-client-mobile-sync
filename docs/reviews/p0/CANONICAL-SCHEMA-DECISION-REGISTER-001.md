# CANONICAL-SCHEMA-DECISION-REGISTER-001

**Version:** 1.0  
**Decision date:** 2026-11-10  
**Scope:** Canonical PostgreSQL–SQLite schema and authorization model  
**Status:** DEC-001–DEC-005 APPROVED; DEC-006–DEC-008 OPEN  
**Related specification:** [CANONICAL-SCHEMA-SPECIFICATION-POSTGRESQL-SQLITE-001.md](./CANONICAL-SCHEMA-SPECIFICATION-POSTGRESQL-SQLITE-001.md)

## 1. Purpose

This record captures the user's explicit approval of DEC-001 through DEC-005 and tracks the remaining technical/evidence gates DEC-006 through DEC-008.

Approval in this register is limited to domain rules and schema specification direction. It does not authorize code changes, DDL execution, migrations, shared/live test execution, PR creation, merge, deployment, or staging/production mutation.

## 2. Approved decisions

### DEC-001 — Tenant-to-legal-party binding cardinality

**Status:** APPROVED  
**Approval:** Explicit user confirmation, 2026-11-10.

**Decision:** A tenant may have at most one verified and currently effective `tenant_legal_party_binding` at a time. Previous binding versions must be retained. A legal-party change must use a new version with effective period, verification evidence, verifier attribution, and audit history.

**Normative controls:**
- No overlapping verified/effective binding periods for the same tenant.
- A verified binding requires verification evidence and verifier attribution.
- Historical binding records are retained; no destructive replacement.
- A tenant binding change does not silently alter the legal-party identity on an existing transaction or signed contract snapshot.
- Contract-party changes follow applicable amendment and legal approval rules.

**Database implication:** PostgreSQL temporal exclusion/serialized enforcement; SQLite trigger plus serialized transaction. Both must reject the same overlap cases.

### DEC-002 — Supplier participant cardinality

**Status:** APPROVED  
**Approval:** Explicit user confirmation, 2026-11-10.

**Decision:** There is at most one participant record for each `(tenant_id, transaction_id)`. A participant may have multiple user assignments and multiple site links. Different Supplier tenants may each have their own participant record in the same transaction.

**Normative controls:**
- Enforce `UNIQUE (tenant_id, transaction_id)` on `transaction_participants`.
- Do not create duplicate participant rows to bypass lifecycle or authorization.
- User assignments and site links remain child scope records.

### DEC-003 — Transaction-wide permission

**Status:** APPROVED  
**Approval:** Explicit user confirmation, 2026-11-10.

**Decision:** Operational access is site-scoped. Transaction-wide access is permitted only as an explicit, bounded exception; a null site must never mean unrestricted access.

**Normative controls:**
- Operational assignments require exact site scope.
- `site_id = NULL` does not grant broad transaction access.
- Transaction-wide scope must explicitly identify subject, transaction, action, effective period, grant authority, revocation, and audit.
- Transaction-wide scope cannot bypass contract, payment, custody, legal, Syariah, or goods-release policy.

### DEC-004 — Canonical permission action vocabulary

**Status:** APPROVED  
**Approval:** Explicit user confirmation, 2026-11-10.

**Decision:** Use a normalized, controlled permission action catalog shared by Web, Mobile, Desktop, PostgreSQL, and SQLite.

**Normative controls:**
- `permission_actions` stores canonical action codes and lifecycle.
- `transaction_access_assignment_actions` maps assignments to catalog actions.
- Clients cannot create arbitrary action codes.
- Deprecated actions cannot be used for new grants.
- Role membership is an input to server-side permission composition, not proof of resource authorization.
- Sensitive actions retain dedicated domain policy gates.

### DEC-005 — Participant activation and approval

**Status:** APPROVED  
**Approval:** Explicit user confirmation, 2026-11-10.

**Decision:** Participant activation and reactivation follow the previously approved bilateral transaction-scope approval model. Supplier participation additionally requires an independent Supplier tenant, verified legal-party binding, explicit participation approval, and bounded operational scope.

**Normative controls:**
- Scope activation/reactivation requires bilateral approval by relevant Buyer and Seller Authorized Representatives.
- Unilateral protective suspension remains permitted under the previously approved rule.
- Buyer/Seller participation requires verified legal identity and valid participation approval.
- Supplier requires independent tenant identity, verified binding, explicit participation approval, and approved bounded operational scope.
- Pending participants receive no operational access.
- Supplier participation does not grant contract approval, payment approval, or goods-release authority.

**Dependency:** Exact approval evidence and actor authorization must remain aligned with the approved contract lifecycle and ADR P0-001 domain baseline. This decision does not create an alternative approval route.

## 3. Open technical/evidence gates

### DEC-006 — PostgreSQL RLS policy design

**Status:** DESIGN REQUIRED  
**Category:** Technical security architecture; not a pending business-domain approval.

Required outcome:
- RLS policy coverage for tenant-scoped business tables exposed to application access.
- Non-bypass application roles for ordinary requests.
- Server-established tenant context.
- Read filtering and write `WITH CHECK` semantics.
- Narrowly controlled and audited service-role/RLS-bypass access.
- Negative tests using the actual non-bypass application role.
- RLS remains defense-in-depth; backend authorization remains mandatory.

**Closure evidence:** Approved policy matrix, role/privilege review, exact candidate SHA, and negative-access test evidence.

### DEC-007 — SQLite runtime schema provenance

**Status:** NOT VERIFIED  
**Category:** Evidence/provenance gate.

Required evidence:
- Exact SQLite file(s) used by each platform runtime.
- `PRAGMA foreign_keys = ON` verified for every connection.
- Actual schema version and migration history.
- Composite FK inventory via `PRAGMA foreign_key_list`.
- Unique/index inventory via `PRAGMA index_list` and `PRAGMA index_info`.
- Actual CHECK constraints and triggers.
- Runtime/test schema construction parity.
- Connection and transaction behavior relevant to constraint enforcement.

Source SQL alone is not proof of physical runtime schema state.

### DEC-008 — PostgreSQL/SQLite physical parity

**Status:** NOT VERIFIED  
**Category:** Evidence/validation gate.

Required evidence:
- One logical schema contract and common acceptance corpus.
- Disposable PostgreSQL and SQLite databases.
- Same positive and negative fixtures for all applicable invariants.
- Equivalent domain outcomes for constraints and lifecycle cases.
- Documented, justified engine-specific exceptions.
- Results pinned to exact schema version and candidate commit SHA.

## 4. Decision dependency

Recommended sequence:

1. Preserve DEC-001–DEC-005 as approved normative domain rules.
2. Complete DEC-006 RLS policy design and role/privilege mapping.
3. Complete DEC-007 SQLite runtime provenance inspection.
4. Complete DEC-008 cross-engine parity evidence using disposable databases.
5. Reassess critical authorization/schema gaps and implementation readiness only after evidence review.

## 5. Consolidated status

| DEC | Topic | Status |
|---|---|---|
| DEC-001 | One verified/effective legal-party binding per tenant; versioned history | APPROVED |
| DEC-002 | One participant per tenant/transaction | APPROVED |
| DEC-003 | Site-scoped operational access; explicit transaction-wide exception | APPROVED |
| DEC-004 | Normalized canonical permission action catalog | APPROVED |
| DEC-005 | Bilateral scope activation and explicit Supplier participation approval | APPROVED |
| DEC-006 | PostgreSQL RLS policy design | DESIGN REQUIRED |
| DEC-007 | SQLite runtime schema provenance | NOT VERIFIED |
| DEC-008 | PostgreSQL/SQLite parity evidence | NOT VERIFIED |

## 6. Governance boundary

The user approved DEC-001 through DEC-005 as domain/specification decisions. These approvals do not authorize implementation, code edits, DDL, migration creation/execution, shared/live test execution, PR creation, merge, deployment, or staging/production mutation.

DEC-006 through DEC-008 remain open. No status in this register should be interpreted as evidence that a physical database schema, RLS policy, runtime SQLite database, or cross-engine parity has already been implemented or verified.
