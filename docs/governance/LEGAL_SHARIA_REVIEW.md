# Legal & Sharia Review for Financial Transactions

**Gate:** Mandatory before enabling, activating, or representing a financial transaction flow as approved.

Engineering teams and AI agents must not independently declare legal or Sharia compliance.

## Transaction specification required for review

Document the actual transaction, including:
- parties, roles, agency/representation, and authority to contract or sell;
- underlying goods/services, ownership, possession, deliverability, and risk transfer;
- proposed akad(s), sequence, offer/acceptance, conditions, and evidence;
- price, currency, margin, fees, commissions, penalties, discounts, and taxes;
- payment timing, custody, settlement, partial payment, reconciliation, and FX;
- refund, cancellation, reversal, default, dispute, and late-performance handling;
- bank, payment provider, correspondent, insurer, guarantor, and other intermediaries;
- applicable origin, destination, transit, consumer, trade, payment, and financial regulations.

## Review responsibilities

- Legal review must be performed by a qualified reviewer for the relevant jurisdictions and product.
- Sharia review must be performed by a competent Sharia advisor/board appropriate to the transaction.
- Record reviewer identity/authority, scope, source documents, decision, conditions, date, and review validity.
- If the transaction changes materially, reopen the relevant reviews.

## System enforcement requirements

- Unapproved financial flows remain disabled or sandbox-only.
- Client input, AI output, screenshots, and provider callbacks are not approval evidence.
- The backend must enforce transaction state and approval prerequisites.
- Keep an auditable link between the approved transaction specification/version and the deployed implementation.
- Do not imply that a payment method, akad label, or product category is automatically compliant.

## Approval record

| Transaction/spec version | Jurisdiction | Legal reviewer/status | Sharia reviewer/status | Conditions/expiry | Evidence |
|---|---|---|---|---|---|
| TBD | TBD | NOT_STARTED | NOT_STARTED | TBD | TBD |

A financial flow is blocked while either applicable review is pending, failed, expired, or conditional requirements remain unmet. No engineering exception can waive a Legal or Sharia decision.
