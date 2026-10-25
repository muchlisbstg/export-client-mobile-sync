# Export Payment, Samples & Commercial Terms — Design Requirements

**Status:** product requirements only. Payment methods, sample terms, fees, and akad structures require transaction-specific legal, banking, tax, logistics, and Syariah review. No payment provider is integrated merely because it appears in this document.

## 1. Commercial transaction types

The platform must distinguish at least:
- **Quotation / inquiry:** no binding sale or payment collection unless explicitly agreed and reviewed.
- **Paid sample:** sample has a price; separately state sample price, courier/freight, insurance, taxes/duties, lead time, delivery terms, refund/credit policy, and whether its value can be credited against a later bulk order.
- **Free sample:** no product charge, but specify who pays shipping, customs charges, duties/taxes, and what happens if shipment is delayed, rejected, or returned. Do not label a sample "no commercial value" unless the declaration is accurate and permitted by customs rules.
- **Prototype / evaluation unit:** identify whether it is a sale, loan, consignment, temporary export/import, or non-sale shipment. Define ownership, permitted use, return/destruction, IP/confidentiality, and customs procedure.
- **Bulk order / repeat order:** order-specific pricing, quantity tolerances, quality inspection, delivery milestones, acceptance, payment schedule, and remedies.
- **Replacement / warranty / return:** distinguish replacement without payment, credit note, refund, repair, re-export, and return-to-origin customs handling.

Each transaction type needs a specific document checklist and lifecycle; sample flows must not bypass sanctions, product restrictions, customs declarations, data protection, or Syariah review.

## 2. International payment methods to support as selectable options

Treat these as methods to be offered only when the exporter, buyer, corridor, banks, product, and contract support them. Availability and risk vary by country and bank.

| Method | Typical commercial use | Required data/evidence | Key risks / review |
|---|---|---|---|
| Advance payment / bank transfer | New buyer, small order, samples, or negotiated prepayment | Currency, amount, beneficiary account, due date, bank/payment reference, refund rules | Counterparty risk, FX, bank fees, sanctions screening, actual settlement verification |
| Deposit + balance by milestone | Production/custom order | Deposit %, milestones, due dates, production/shipping evidence, balance calculation | Define cancellation and refund rights; review akad and ownership/risk transfer |
| Open account / post-shipment terms | Established buyer under credit policy | Credit limit, invoice, due date, credit approval, collection status | Credit/default risk, receivable aging, legal enforceability, insurance/guarantee structure |
| Documentary collection D/P | Documents released against payment | Collection instruction, documents list, remitting/collecting banks, fees, due date | Banks handle documents, not a guarantee that buyer will pay or accept goods |
| Documentary collection D/A | Documents released against accepted payment undertaking | Draft/acceptance, maturity date, buyer credit approval, bank collection instruction | Higher exporter credit risk; legal and bank review required |
| Documentary credit / Letter of Credit (LC) | Larger orders or agreed bank-backed document process | Issuing/advising/confirming bank, amount/currency, expiry, presentation place, latest shipment date, required documents, applicable rules | Documentary discrepancies, bank/country risk, fees; state UCP 600/eUCP only if expressly incorporated as applicable |
| Bank guarantee / standby LC | Performance or payment support where agreed | Issuer, beneficiary, amount, trigger, expiry, claim documents, governing rules | Independent undertaking and demand conditions require specialist review; Syariah treatment/fees must be reviewed |
| Escrow / payment service provider | Platform-mediated settlement where legally permitted | Licensed provider, custody model, settlement timing, fees, refund/dispute rules, countries/currencies | Do not hold client funds or act as payment intermediary without required licensing and controls |
| Islamic trade finance / bank facility | Eligible corridor and bank product | Actual product/akad, bank's role, asset/ownership evidence, fees/profit, schedule, collateral/guarantee | Product name alone does not prove Syariah compliance; review executed contracts and bank/adviser approval |
| Documentary/electronic presentation | When supported by banks and agreed parties | Format, authenticity, delivery/receipt time, version, governing e-rules if incorporated | Confirm the bank and credit expressly accept electronic records |

The app should record **method selected, contractual basis, payment milestones, expected/actual amount, currency, fees borne by each party, due dates, bank/provider references, reconciliation state, refunds, disputes, and evidence**. Never store raw card data, bank passwords, payment credentials, or secrets in mobile storage or logs.

## 3. Syariah payment gate

For each payment structure, store:
- Approved contract/akad type and version, parties, scope, and responsible Syariah reviewer.
- Underlying sale/service, asset or goods, seller's authority/ownership where required, price, currency, delivery and risk allocation.
- Whether price is fixed or deferred, and how fees, agency compensation, guarantees, collateral, FX conversion, and refunds are treated.
- Late-payment/default provisions, charity clauses if any, and prohibition on automatically accruing interest or compounding late fees.
- Bank/provider and financing product documentation; distinguish a bank's payment undertaking from financing.
- Review decision, conditions, evidence, reviewer identity, and review date.

Do not automatically declare an LC, D/A, bank guarantee, escrow, FX transaction, late fee, or Islamic-finance product compliant. The legal and Syariah status depends on structure, documents, jurisdiction, and execution. No AI or client UI may approve the Syariah gate.

## 4. Sample shipment controls

Required fields:
- Sample purpose: evaluation, testing, demonstration, certification, marketing, repair, or prototype.
- Sale status: paid, free of charge, loan/temporary shipment, replacement, or return.
- Accurate description, material/composition, quantity, unit value and total customs value, currency, country of origin, HS classification, and intended use.
- Exporter, importer, consignee, end-user, final destination, transit route, and product-specific restrictions.
- Invoice/pro-forma invoice as appropriate, packing list, transport document, origin/certification/permit documents where required, and any required declaration.
- Shipping term / Incoterms® rule and named place; who pays freight, insurance, customs duties, taxes, and return freight.
- Delivery confirmation, sample acceptance/rejection, test report if relevant, return/destruction evidence, and follow-up order linkage.
- Data minimization: never put personal data or secrets in public sample documents or QR codes.

A "free sample" may still have a customs value and can still trigger import duties, permits, or product controls. Do not hard-code a zero value or a universal exemption. Temporary export/import and returned goods need a jurisdiction-specific procedure and deadline.

## 5. Documents and lifecycle checklist

Suggested lifecycle:
`INQUIRY` → `QUOTATION` → `CONTRACT_REVIEW` → `PAYMENT_TERMS_PENDING` → `COMPLIANCE_REVIEW` → `ORDER_CONFIRMED` → `SAMPLE_OR_PRODUCTION` → `PRE_SHIPMENT_CHECK` → `SHIPPED` → `PAYMENT_RECONCILIATION` → `DELIVERED` → `CLOSED`.

Possible holds: `DOCUMENTS_MISSING`, `PAYMENT_UNVERIFIED`, `LEGAL_REVIEW_REQUIRED`, `SHARIAH_REVIEW_REQUIRED`, `SANCTIONS_REVIEW_REQUIRED`, `CUSTOMS_HOLD`, `DISPUTE`. These statuses must be assigned server-side and include reason, actor, timestamp, and rule/contract version.

The document engine should support, when relevant: quotation/pro-forma invoice, commercial invoice, purchase order, sales contract, packing list, export declaration, certificate of origin, product permits/certificates, inspection/quality report, transport document, insurance/takaful evidence, LC/collection instructions, payment proof, delivery proof, refund/credit note, and sample return/destruction evidence. This is not a universal list; the destination, commodity, payment method, contract, and customs procedure determine the actual checklist.

## 6. Minimum data model additions

- `commercial_terms`: transaction type, payment method, currency, total, deposit, milestones, due dates, fees allocation, Incoterms rule/named place, refund/cancellation terms.
- `payment_instructions`: payee/beneficiary reference, bank/provider identifier, permitted payment rail, reference, and masked/non-secret details only.
- `payment_events`: pending/authorized/settled/failed/reversed/refunded/disputed states, provider event ID, idempotency key, timestamp, amount/currency and evidence; reconcile against trusted provider/bank evidence.
- `sample_shipments`: purpose, sale status, accurate customs value, HS/origin/destination, end-user, return deadline, shipping cost allocation, declaration/documents and disposition.
- `syariah_reviews`: akad and product version, reviewer, findings, conditions, evidence, scope and expiry/review date.
- `document_requirements`: jurisdiction, commodity, transaction/sample type, payment method, rule-pack version, required/conditional status and official source.
- `refunds_disputes`: reason, amount/currency, case owner, due date, decision, evidence, resolution and audit history.

Money must use integer minor units plus ISO currency code (or a well-defined decimal representation); never floating point. Store payment state transitions append-only, use provider idempotency, verify webhooks/signatures, and reconcile statements. A screenshot or client claim is not proof of settlement.

## 7. Acceptance criteria

1. User can request a quotation and select a payment method only from options allowed for the transaction/corridor.
2. No method is marked Syariah-approved unless an authorized reviewer approved the actual structure and version.
3. Advance, deposit, milestone, deferred, D/P, D/A, LC, guarantee/standby, escrow/provider, and Islamic-finance options have explicit prerequisites and limitations.
4. Sample paid/free/temporary/return flows capture accurate customs value and the required route-specific evidence.
5. Sample shipments cannot bypass product restrictions, end-user screening, permits, tax/customs checks, or legal/Syariah review.
6. Payment state cannot be changed to settled by mobile input alone; it must be reconciled to a trusted bank/provider source or a documented authorized manual process.
7. Duplicate provider events are idempotent; refunds, reversals, partial payments, chargebacks/disputes and currency differences are recorded without overwriting history.
8. Missing/expired contract or document, unverified payment, changed destination, or changed terms trigger the appropriate review.
9. Tests cover wrong currency/amount, duplicate webhook, invalid signature, replay, refund, partial payment, expired LC, documentary mismatch, sample return deadline, and cross-tenant access.
10. All provider integrations, regulatory requirements, and Syariah product structures are reviewed before production; use sandbox credentials and synthetic data during development.

## 8. External standards and review

- Documentary credits: ICC UCP 600 applies where the credit expressly incorporates it; electronic presentation rules may require eUCP when agreed.
- Documentary collections: ICC URC 522 applies where the collection instruction expressly incorporates it.
- Syariah: use the applicable local regulatory framework and qualified Syariah advisers. AAOIFI standards can be a reference where adopted or contractually applicable; do not present them as universally binding in every country.
- Incoterms®: specify the edition, rule, and exact named place in the contract; it does not replace payment rules, title transfer, customs obligations, or Syariah review.

Official/reference starting points:
- ICC UCP 600 rules: https://library.iccwbo.org/content/tfb/RULES/tfb-ucp600-rules.htm
- ICC trade finance overview: https://academy.iccwbo.org/trade-finance/article/what-is-export-financing/
- AAOIFI Shariah Standards: https://aaoifi.com/shariah-standards-3/?lang=en

These references are starting points, not substitutes for the actual bank terms, current applicable rules, legal advice, or a transaction-specific Syariah opinion.
