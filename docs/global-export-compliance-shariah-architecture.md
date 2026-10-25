# Global Export Compliance & Shariah Architecture

**Status:** design requirements / implementation backlog. This document is not legal advice, a compliance certification, a fatwa, or evidence that any control is implemented.

## 1. Purpose and scope

The export platform must support a global business operating from Indonesia and shipping to multiple destination countries. Compliance must be determined for each transaction—not inferred from the buyer's country alone. Applicable requirements can depend on exporter/importer, product classification, origin, destination, transit route, end user, intended use, payment method, contract terms, and transaction date.

The mobile repository is one client/sync node. It must not be the authority for legal decisions. The authoritative compliance evaluation belongs in a trusted backend/service, with versioned rules, auditable decisions, and human review for uncertain or high-risk cases.

## 2. Target architecture

```text
Mobile / Web / Desktop clients
            |
            v
Authenticated API Gateway
            |
            v
Export Transaction Service ------ Identity, roles & tenant membership
            |
            +---- Product & HS classification registry
            +---- Parties: exporter, buyer, consignee, end-user
            +---- Origin / destination / transit route
            +---- Documents & evidence vault
            +---- Jurisdiction Rules Registry (versioned)
            +---- Compliance Evaluation Engine
            +---- Shariah Contract & Transaction Review
            +---- Human Review / Approval Workflow
            +---- Audit Event Ledger
            |
            v
Transaction Gate: DRAFT -> CHECKS_PENDING -> REVIEW_REQUIRED / BLOCKED
                                      -> CLEARED_FOR_OPERATION (scoped, expiring)
            |
            +---- Customs / logistics / tax / payment integrations
            +---- Sync outbox with idempotency, retry, reconciliation
```

**Trust boundary:** clients and peer-sync payloads are untrusted input. They may submit evidence and request an evaluation, but cannot set their own compliance status, bypass a hold, approve themselves, or replace the server-side decision. Peer sync transports records; it does not constitute regulatory clearance.

## 3. Jurisdiction and rule-pack model

Use independently versioned rule packs rather than hard-coded country conditionals. Each rule record should contain:

- Stable rule ID and version; jurisdiction and competent authority.
- Scope: product/HS code, parties, route, transaction type, value thresholds, end-use, and applicable dates.
- Requirement type: registration/licence, customs declaration, permit, product standard, certificate, labelling, tax, sanctions/restricted-party screening, privacy/data transfer, record retention, or other obligation.
- Required evidence and validation method; source URL/document, publication/effective dates, last legal review, reviewer, and confidence/status.
- Decision effect: informational, document required, manual review, block pending evidence, or reject when legally prohibited.
- Exception/waiver process where legally permitted, including named approver, rationale, expiry, and immutable audit event.

Rule states: `DRAFT`, `UNDER_LEGAL_REVIEW`, `APPROVED_FOR_USE`, `SUPERSEDED`, `SUSPENDED`. Only an authorized, reviewed rule pack can drive operational gates. Rules must be evaluated against the transaction's relevant date and a recorded rule-pack version. Unknown or stale rules must fail safely into review—not silently return compliant.

## 4. Indonesia-origin baseline

For exporters operating from Indonesia, the rules registry should be able to capture, verify, and evidence the applicable obligations, including where relevant:

- Business identity, business licensing and risk-based licensing requirements through the applicable Indonesian government process.
- Exporter eligibility, customs registration/data, export declaration (PEB) and customs procedures.
- Product-specific export prohibitions/restrictions, export approvals, technical recommendations, quotas, and supporting certificates where applicable.
- Commodity-specific requirements, such as origin evidence/Certificate of Origin, quarantine, sanitary/phytosanitary, health, quality, or inspection documents when applicable.
- Tax, foreign-exchange/payment, banking, and transaction-record obligations applicable to the business and commodity.
- Indonesian personal-data protection, cybersecurity, retention, and cross-border data handling requirements where personal data is processed.
- Contract, consumer/business, competition, anti-bribery, anti-money-laundering, and other obligations when they apply to the business model and transaction.

The exact obligation set must be determined from the commodity, HS classification, exporter profile, destination, and effective rules at shipment time. Do not assume every export requires every certificate, nor that one generic licence is sufficient. Integrations and document checklists must be confirmed with Indonesian legal counsel, customs specialists, and the relevant authorities.

## 5. Destination, transit, and international requirements

For each destination and any transit/re-export jurisdiction, provide a configurable checklist for the applicable items, such as:

- Importer registration and import permits; customs declarations and duties/taxes.
- Product safety, technical conformity, labelling, packaging, language, and market-access rules.
- Food, agricultural, animal/plant, chemical, medical, electronics, or other sector-specific controls as applicable.
- Sanctions, embargoes, restricted-party, dual-use/export-control, end-user, and end-use checks where applicable.
- Origin marking, preferential trade agreement evidence, and Certificate of Origin requirements.
- Privacy, data localization/transfer, electronic transaction, and records obligations where applicable.
- Tax/VAT/GST, invoicing, transfer pricing, and permanent-establishment considerations where relevant.
- Documentary and transport requirements, including the agreed Incoterms® rule and named place. Incoterms allocate defined delivery/cost/risk responsibilities; they do not replace customs, licensing, or legal compliance.

The rules engine must support multiple jurisdictions in a route and re-evaluation when destination, HS code, buyer/end-user, route, product, contract, or applicable law changes.

## 6. Syariah governance

Syariah requirements are core product governance—not a marketing badge. The platform should record the selected contract/akad, parties and capacity, underlying goods/services, price/currency, payment and delivery obligations, risk transfer, ownership/possession evidence where relevant, and amendment/cancellation history.

Controls to be designed and reviewed by qualified Syariah advisers include:

- Contract structure appropriate to the actual transaction (do not automatically label all export sales as murabahah, wakalah, salam, or another akad).
- Clear disclosure of goods, quality/specification, quantity, price, delivery, payment terms, responsibilities, and material risks.
- Avoidance of prohibited riba, excessive gharar, maysir, fraud, deception, and transactions in prohibited goods or uses, subject to the approved policy and scholarly review.
- Evidence that the seller has the ownership/authority required by the selected akad before making representations or selling.
- Late-payment, default, penalty, rebate, agency fee, FX, insurance/takaful, trade-finance, and dispute clauses reviewed for Syariah suitability.
- Separation of commercial approvals from Syariah review; capture adviser/committee decision, evidence, version, date, scope, and any conditions.
- A documented escalation path for disputed or novel structures. Software must not issue a fatwa or infer Syariah approval from a completed checklist.

A Syariah review result is transaction- and contract-scope-specific. Do not claim certification or institutional endorsement unless formally obtained and verified.

## 7. Transaction gate and state model

Suggested lifecycle:

1. `DRAFT`: transaction and product data can be edited.
2. `EVIDENCE_PENDING`: collect required licences, certificates, contracts, and party data.
3. `SCREENING_PENDING`: evaluate parties, product, route, jurisdiction packs, and dates.
4. `REVIEW_REQUIRED`: unresolved rule, missing evidence, potential match, exception, or Syariah review.
5. `BLOCKED`: confirmed prohibition or unmet mandatory requirement; record reason and rule version.
6. `CLEARED_FOR_OPERATION`: all required controls passed by authorized reviewers for the defined transaction scope; clearance expires or is invalidated when material facts/rules change.
7. `SHIPPED` / `COMPLETED`: retain final declaration, transport, delivery, payment, and reconciliation evidence.
8. `CANCELLED` / `REJECTED`: preserve lawful audit history and reason.

A green status means only that the configured, approved checks passed for the recorded facts and time. It is not a universal guarantee of legality. No client-supplied status is authoritative. Material changes must invalidate or trigger reevaluation of clearance.

## 8. Minimum data model

- `export_transactions`: tenant, exporter, buyer, consignee, end-user, product, quantity, value/currency, Incoterms rule and named place, shipment date, origin/destination/transit route, status.
- `product_classifications`: product attributes, HS code, classification jurisdiction/version, evidence, reviewer and effective dates.
- `jurisdiction_rule_packs` / `compliance_rules`: version, scope, authority/source, dates, review status, decision logic and evidence requirements.
- `compliance_evaluations`: transaction ID, facts snapshot/hash, rule-pack versions, findings, result, evaluator, timestamp, expiry and invalidation reason.
- `documents`: type, issuer, reference, issue/expiry dates, country/scope, integrity hash, access policy, verification state, retention class. Store files in a protected object store, not public mobile storage.
- `review_decisions`: reviewer identity/role, legal or customs review, Syariah review, decision, rationale, conditions, timestamps and references.
- `audit_events`: append-only actor/action/object, before/after reference or hash, reason, correlation ID and timestamp.
- `sync_outbox`: durable event ID, tenant ID, sequence, payload version, idempotency key, attempts, next retry, delivery status and conflict details.

Enforce tenant membership and authorization on the server for every read/write. Do not sync unnecessary personal documents or secrets to every peer. Use least-privilege access, encryption in transit/at rest, document access logs, backup/restore testing, and retention/deletion rules compatible with legal holds and recordkeeping obligations.

## 9. Security, privacy, and audit requirements

- Server-side authentication and object/tenant authorization; never trust client tenant IDs or approval flags.
- TLS for all non-local communications; peer identity and secret/certificate rotation.
- Encryption and key management for documents and sensitive records.
- Restricted-party screening with documented match resolution; potential matches go to trained human review.
- Immutable or tamper-evident audit history for rule changes, document verification, evaluation, overrides, and approvals.
- Least-privilege role separation: preparer, compliance reviewer, customs/legal reviewer, Syariah reviewer, approver, auditor, administrator.
- Idempotent, signed/strongly authenticated sync; replay protection, payload versioning, conflict handling, and reconciliation.
- Privacy-by-design, purpose limitation, data minimization, retention schedule, access/export/correction workflows where required, and approved cross-border transfer safeguards.
- Monitoring, incident response, tested backup/restore, vulnerability management, and documented recovery objectives.

## 10. Acceptance criteria

Before production use, demonstrate with automated tests and reviewed evidence:

1. A transaction cannot self-mark as cleared from mobile/web/desktop or via peer sync.
2. Missing, expired, superseded, or unreviewed mandatory evidence produces the configured hold/review state.
3. The same transaction evaluated against different approved jurisdiction packs records each pack version and its findings.
4. Changing HS code, destination, end-user, route, shipment date, contract/akad, or a material value triggers reevaluation.
5. A prohibited transaction is blocked according to the approved rule; ambiguous screening matches require human review.
6. Users cannot read or modify another tenant's transaction or restricted document.
7. Peer retries are idempotent; conflicting payloads are preserved for review and do not overwrite authoritative approvals.
8. Legal/customs and Syariah approvals record the real reviewer, scope, rationale, timestamp, and evidence; no automated AI decision can approve a legal or Syariah gate.
9. Expired clearance cannot be reused after a material change or relevant rule update.
10. Backup restoration, audit integrity, incident handling, and retention behavior are tested.
11. Tests use synthetic or properly sanitized data; CI results are tied to the exact commit SHA.
12. Each enabled rule pack has a source, effective date, named accountable reviewer, next review date, and documented limitations.

## 11. Human governance and rollout

- **Phase 1 — discovery:** select pilot commodities and a limited corridor (Indonesia to one destination); identify exporter/importer roles, product classification, document flows, and competent advisers.
- **Phase 2 — rule register:** build a source-linked legal obligation matrix for Indonesia, destination, and transit; mark uncertain items for counsel review.
- **Phase 3 — architecture and tests:** implement versioned rule packs, evidence workflow, server-side gate, audit events, and negative security tests.
- **Phase 4 — pilot:** run only in sandbox/shadow mode with synthetic or approved test data; compare system findings against legal/customs and Syariah reviewers.
- **Phase 5 — controlled launch:** enable a narrowly scoped workflow only after written approvals, security/privacy review, operational readiness, and human go-live approval.
- **Ongoing:** monitor legal changes, update rule packs with dual review, preserve prior versions, and periodically revalidate live corridors.

## 12. Required project artefacts

- Jurisdiction/commodity obligation matrix with official source links and effective dates.
- Product/HS classification decision record.
- Document checklist and evidence validation specification.
- Role/approval matrix and transaction state machine.
- Syariah akad policy, approved templates, and adviser review record.
- Threat model, privacy/data-flow map, retention schedule, incident and recovery runbooks.
- Test evidence, CI run references, risk acceptance records, and signed go-live checklist.

**Non-goal:** this repository and README do not themselves provide legal advice, customs brokerage, regulatory filing, a fatwa, or certification. Exact obligations must be verified for the specific commodity, parties, route, transaction date, and jurisdiction by qualified professionals and authoritative sources.
