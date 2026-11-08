# ADR P0-001 — Transaction party bridge and tenant-scoped composite integrity

- **Status:** Proposed — requires domain-owner, database-reviewer, and security-reviewer approval
- **Date:** 2026-11-08
- **Scope:** Transaction-party membership and integrity constraints for `transaction_access_assignments` and `transaction_site_links`
- **Implementation:** None. This ADR does not contain executable DDL and authorizes no migration.

## Context

A commercial transaction identifies a buyer enterprise and a seller enterprise through `commercial_transactions.buyer_tenant_id` and `seller_tenant_id`. A transaction access assignment or site link is scoped by `tenant_id`, but the current foreign keys independently validate the tenant and transaction identifiers. They do not prove that the tenant is one of the two parties to that transaction. Site references likewise need to prove that the site belongs to the same tenant as the assignment or link.

The current schema inspector reports five blockers:
1. `transaction_enterprise_parties` bridge missing.
2. Assignment `(tenant_id, transaction_id)` composite FK missing.
3. Assignment `(tenant_id, site_id)` composite FK missing.
4. Site-link `(tenant_id, transaction_id)` composite FK missing.
5. Site-link `(tenant_id, site_id)` composite FK missing.

## Proposed decision

Use an explicit transaction-party bridge that represents the *enterprise legal party* to the transaction. Do not use a user, membership, role assignment, warehouse, supplier operator, or free-form external counterparty as the tenant party identity.

Proposed logical relation:

```text
transaction_enterprise_parties
  tenant_id       -> tenants.id
  transaction_id  -> commercial_transactions.id
  party_role      -> buyer | seller
  created_at
  PRIMARY KEY (tenant_id, transaction_id)
  UNIQUE (transaction_id, party_role)
```

The bridge is a materialized, constrained representation of the two party columns already on the transaction:
- `party_role = buyer` must have `tenant_id = commercial_transactions.buyer_tenant_id`.
- `party_role = seller` must have `tenant_id = commercial_transactions.seller_tenant_id`.
- A transaction must have exactly one buyer-party row and one seller-party row once finalized for access-control use.
- The existing `CHECK (buyer_tenant_id <> seller_tenant_id)` remains the default anti-self-dealing rule. Any exception requires an explicit legal/business decision, not a technical bypass.
- The bridge must not become a source of truth independent of the transaction party columns. Insert/update/delete synchronization and transaction lifecycle semantics must be enforced atomically using database constraints/triggers or a reviewed normalized redesign.

Then enforce:
- `transaction_access_assignments(tenant_id, transaction_id)` → `transaction_enterprise_parties(tenant_id, transaction_id)`.
- `transaction_site_links(tenant_id, transaction_id)` → `transaction_enterprise_parties(tenant_id, transaction_id)`.
- `transaction_access_assignments(tenant_id, site_id)` → `supply_sites(tenant_id, id)`.
- `transaction_site_links(tenant_id, site_id)` → `supply_sites(tenant_id, id)`.

Both referenced composite keys must be explicitly UNIQUE/PRIMARY KEY. For assignment `site_id`, NULL remains allowed only for roles whose authorization policy permits transaction-wide scope (buyer, seller, auditor); operational roles supplier, warehouse, QC, and logistics require a non-NULL site. A composite FK with nullable `site_id` does not validate a site when the child key is NULL, so the role/site CHECK or equivalent trigger must enforce the policy. Site links always require a site.

## Alternatives considered

1. **Two separate tenant and transaction FKs only:** rejected; it cannot enforce that the tenant is a party to the referenced transaction.
2. **Store party role only on assignments:** rejected; duplicates domain truth across assignments and cannot protect site links or other future child tables.
3. **Treat every supplier/operator tenant as a buyer/seller party:** rejected; operational participation is not equivalent to contractual legal-party status.
4. **External legal-party registry:** deferred. If buyers/sellers may be non-platform organizations without a tenant account, a governed `legal_parties` entity and explicit tenant-to-legal-party mapping must be designed before implementation. Do not overload `tenant_id` with an external party identifier.

## Domain decisions required before approval

The product/legal owner must confirm:
1. Are buyer and seller always platform `tenants`, or can a contracting party exist outside the platform?
2. Does one tenant ever act as both buyer and seller in one transaction? The proposed default rejects this.
3. When is the party bridge created: draft transaction creation, contract approval, or another lifecycle transition?
4. Can party identity change after contract approval? If so, what amendment, audit, and consent process applies?
5. Are operational suppliers/logistics providers strictly delegated operators, or can they be contractual parties? The proposed model treats them as operators unless separately recorded as buyer/seller.
6. Is enterprise-wide NULL site scope allowed for buyer, seller, and auditor roles only? Confirm with the authorization policy owner.

## SQLite and PostgreSQL parity

- Implement the same party-role semantics and composite-key integrity in SQLite and PostgreSQL.
- PostgreSQL must have explicit RLS policies for the bridge and both child tables. RLS is not a substitute for FKs.
- Test both buyer-side and seller-side positive inserts, non-party tenant denial, foreign-site denial, mismatched transaction/site tuples, duplicate party roles, revocation, and NULL-site role policy.
- Test under the actual application DB roles, including an unprivileged role; owner/superuser tests alone do not prove RLS.
- Include deferred/transactional lifecycle behavior if transaction creation and party-bridge creation occur in one transaction.

## Migration and operational safeguards

No migration is authorized by this ADR. Before a migration PR:
- inventory existing rows and classify orphan/mismatched assignments and site links without guessing ownership;
- produce a deterministic remediation report and explicit manual-resolution queue;
- design additive migration, backfill, validation, enforcement, and rollback phases;
- prove SQLite and PostgreSQL parity with isolated synthetic fixtures;
- include lock/availability, index-build, deployment-order, rollback, and backup considerations;
- obtain database reviewer approval and security reviewer concurrence.

## Acceptance criteria

- [ ] Domain/legal owner confirms all six domain decisions above.
- [ ] Database reviewer approves ERD, key design, triggers/constraints, RLS, migration, and rollback plan.
- [ ] Security reviewer confirms tenant and site isolation, including NULL-site semantics.
- [ ] Schema inspector reports zero blockers on an isolated candidate schema.
- [ ] SQLite tests and PostgreSQL integration/RLS tests pass on one exact SHA.
- [ ] No staging/production DDL is run without separate explicit authorization.

## Decision

**Not approved.** This is a concrete technical recommendation for review, not a binding business/legal decision. Keep the five schema blockers OPEN until the domain owner and independent reviewers approve the final design.
