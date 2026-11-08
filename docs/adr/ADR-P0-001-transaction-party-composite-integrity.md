# ADR P0-001 — Separate contractual parties from tenant authorization scopes

- **Status:** Recommended architecture; pending business/legal, database, and security approval
- **Date:** 2026-11-08
- **Scope:** Transaction party identity and four tenant-scoped composite foreign keys
- **Implementation:** Design and read-only contract inspection only. No DDL or migration is included or authorized.

## Decision recommendation

Adopt a **single operating enterprise with separately modeled external contractual parties**. Do not use `tenant_id` as a proxy for buyer/seller legal identity unless the domain owner explicitly confirms that every buyer and seller is a platform tenant.

This aligns with the current deployment blueprint's product direction: one configured operating enterprise, internal role-based operations, and external buyer/seller counterparties. It also avoids conflating three distinct concepts:

1. **Legal party:** the organization or person named as buyer/seller in the commercial contract.
2. **Tenant/enterprise:** an authorization and data-isolation boundary for users and internal operations.
3. **Transaction scope:** the tenant(s) explicitly permitted to access and operate on a transaction.

### Target logical model

**A. Contractual party registry**

```text
legal_parties
  id, legal_name, country_code, registration_reference, status, created_at

commercial_transactions
  id
  buyer_party_id  -> legal_parties.id
  seller_party_id -> legal_parties.id
  operating_tenant_id -> tenants.id
  status, created_at
```

- Buyer and seller are legal-party references, not automatically tenants.
- `operating_tenant_id` identifies the enterprise operating the transaction in the single-enterprise model.
- The same legal party may participate in multiple transactions; party identity must not be duplicated per transaction.
- Preserve immutable party snapshots/contract version references where legal documents require the identity at signing time.
- A transaction must not silently change buyer/seller after contract approval; amendments require explicit actor, reason, version, audit, and counterparty consent rules.

**B. Tenant transaction scope bridge**

```text
transaction_tenant_scopes
  tenant_id       -> tenants.id
  transaction_id  -> commercial_transactions.id
  scope_kind      -> operating | delegated
  created_at
  PRIMARY KEY (tenant_id, transaction_id)
```

This bridge is an authorization scope, not a statement that the tenant is the buyer or seller. In the current single-enterprise configuration, the operating tenant receives the `operating` scope. Additional `delegated` tenant scopes require an explicit contract, legal, and security policy; they must never be inferred from a party name or client-supplied tenant header.

**C. Transaction party access**

If external buyer/seller users are allowed to sign in, model their access separately, e.g. `transaction_party_access_assignments(transaction_id, legal_party_id, user_id, party_role, status)`, with verified identity-to-party membership, party-role consistency, revocation, audit, and non-disclosing reads. Do not insert external counterparties into the operating tenant's `tenant_memberships` merely to make authorization queries pass.

If Buyer/Seller are only internal employee roles in the current release, keep them as internal enterprise roles and do not enable external party login until the separate party-access model is implemented and reviewed.

## Composite FK decision

Use the scope bridge for tenant isolation and the existing tenant-scoped site key for site isolation:

1. `transaction_access_assignments(tenant_id, transaction_id)` → `transaction_tenant_scopes(tenant_id, transaction_id)`.
2. `transaction_site_links(tenant_id, transaction_id)` → `transaction_tenant_scopes(tenant_id, transaction_id)`.
3. `transaction_access_assignments(tenant_id, site_id)` → `supply_sites(tenant_id, id)`.
4. `transaction_site_links(tenant_id, site_id)` → `supply_sites(tenant_id, id)`.

The referenced composite pairs must be explicit PRIMARY KEY/UNIQUE keys. The five source-level blockers are therefore resolved conceptually by introducing the scope bridge and these four composite FKs.

### Site nullability

- `transaction_site_links.site_id` remains NOT NULL.
- `transaction_access_assignments.site_id` may be NULL only for roles with explicitly approved transaction-wide scope (provisionally buyer, seller, auditor, and enterprise_admin).
- Operational roles (supplier, warehouse, QC, logistics) require a non-NULL site and an active matching `transaction_site_links` row.
- A composite FK does not validate a nullable child key when `site_id` is NULL; add a role/site CHECK or trigger and test it in both SQLite and PostgreSQL.

## Why not use transaction_enterprise_parties as the scope bridge?

That name implies that every scoped tenant is a contractual buyer/seller. It is incorrect for a single operating enterprise that may serve external counterparties who do not have tenant accounts. Use `transaction_tenant_scopes` for access scope and `legal_parties` for contractual identity. If the domain owner confirms a true multi-tenant buyer/seller model, an explicit party-to-tenant mapping can be added without collapsing the two concepts.

## Domain decisions requiring written confirmation

1. Confirm the product model is one operating enterprise plus external buyer/seller legal parties.
2. Confirm whether Buyer/Seller roles in the current release are internal staff roles or external counterparty users.
3. Confirm whether any delegated tenant can operate on a transaction and under what contract/consent.
4. Confirm transaction creation and scope-bridge lifecycle (draft, accepted, contract-approved).
5. Confirm whether legal party identity can change after contract approval and the amendment process.
6. Confirm enterprise-wide NULL site scope and allowed roles.
7. Confirm required legal identifiers, jurisdiction/country rules, retention, and immutable signed-contract snapshots with qualified counsel.

## SQLite and PostgreSQL parity

- Implement equivalent scope-bridge and composite-FK constraints in SQLite and PostgreSQL.
- PostgreSQL RLS must cover `transaction_tenant_scopes`, assignments, site links, legal parties, and any party-access table. RLS is defense in depth, not a substitute for FKs.
- Test operating and delegated scope positive cases; non-scoped tenant denial; foreign-site denial; mismatched transaction/site tuples; duplicate scope rows; NULL-site policy; party-role mismatch; membership revocation; and non-disclosing cross-tenant reads.
- Run tests under the actual least-privilege application DB role. Owner/superuser tests do not prove RLS.
- Require PostgreSQL integration tests; SQLite tests alone are not evidence of PostgreSQL behavior.

## Migration and operational safeguards

No migration is authorized. Before a migration PR:
- inventory existing buyer/seller tenant values and determine whether they represent legal parties, platform tenants, or internal operational records;
- do not automatically convert legacy tenant IDs into legal-party IDs;
- produce deterministic mismatch/orphan reports and a manual-resolution queue;
- design additive migration, backfill, validation, enforcement, rollback, and deployment ordering;
- review data protection, legal-party retention, and contract amendment/audit semantics;
- obtain independent database review and security concurrence.

## Acceptance

- [ ] Business/legal owner confirms the product/party model and lifecycle decisions above.
- [ ] Independent database reviewer approves ERD, constraints, indexes, RLS, migration, and rollback.
- [ ] Independent security reviewer approves tenant scope, party access, NULL-site policy, and revocation.
- [ ] Read-only schema inspector reports zero blockers on an isolated candidate schema.
- [ ] SQLite tests and PostgreSQL integration/RLS tests pass on one exact SHA.
- [ ] No staging/production DDL without separate explicit authorization.

**Decision state: NOT APPROVED.** This is the recommended target architecture, not a binding legal/business decision. Keep all five schema blockers OPEN until the domain owner and independent reviewers approve it.
