# Governance disposition — PR #132 export sale akad framework

**Record date:** 2026-11-08  
**Repository:** `muchlisbstg/export-client-mobile-sync`  
**Main baseline reviewed for this record:** `7d27b838cb0af02ebc8412da2438d235ac860a8f`  
**Disposition:** merged as repository documentation; contract/akad approval remains **NOT GRANTED**.

## 1. Purpose

This record reconciles the repository state of PR #132 with the prior governance direction that the export sale akad framework remain a Draft/Open working document pending review of an actual export transaction and its clauses.

This is an append-only governance clarification. It does not rewrite the historical PR event, reverse the merge, approve the document, or authorize implementation.

## 2. Verified GitHub event record

| Evidence | Verified value |
|---|---|
| Pull request | [#132](https://github.com/muchlisbstg/export-client-mobile-sync/pull/132) |
| PR state | Closed; merged |
| PR head | `88b0f71d9afe0381740d3ecfb03cfb2a18bfbcea` |
| PR base before merge | `3cc1165aa62549a860140af9fd35e89acd72592a` |
| Merge commit | `79bf932b85b5e7bc618a42de8feb6565061ef869` |
| Merge time | 2026-11-08 05:31:47 UTC |
| Changed path | `docs/contracts/DRAFT-EXPORT-SALE-AKAD-TEMPLATE.md` |
| Review event before merge | `COMMENTED`, body “Approved ”, submitted 2026-11-08 05:31:41 UTC |
| Review event semantics | The recorded review state is `COMMENTED`, not GitHub `APPROVED`. |

The available PR payload does not expose a verified `merged_by` identity. The merge commit metadata identifies the repository owner as author and `web-flow` as committer; this metadata alone does not establish who initiated the merge. No actor attribution is made in this record.

## 3. Reconciled interpretation

The historical Draft/Open instruction and the later merged repository state are both retained as facts. The merge cannot be retroactively treated as if it had not occurred.

The merge is classified strictly as **repository content integration**. It is not:
- approval of an akad type or transaction structure;
- Legal or Sharia approval, fatwa, certification, or legal opinion;
- acceptance of any clause by Seller or Buyer;
- authorization to sign, activate payment, release goods, or transact;
- approval of DDL, migration, application implementation, deployment, or release.

## 4. Current artifact status on main

At the reviewed baseline, `docs/contracts/DRAFT-EXPORT-SALE-AKAD-TEMPLATE.md` continues to state:
- “DRAFT KERJA — BELUM DISETUJUI” and “DRAFT — NOT APPROVED”;
- no akad type is selected;
- transaction identity, parties, commodity, destination, price, payment, delivery, governing law, and other facts remain TBD;
- Legal Indonesia, Legal destination jurisdiction, Sharia, Finance/Treasury, Export/Customs/Logistics, Seller, and Buyer reviews remain NOT_STARTED;
- the document must not be signed or used for a transaction.

Therefore, the substantive approval state remains **NOT APPROVED**. This record does not promote or modify the template's status.

## 5. Required governance controls going forward

1. Keep the template explicitly marked DRAFT / NOT APPROVED until an actual transaction specification and its clauses are reviewed.
2. Select no akad by template default; assess the actual parties, authority, object, ownership/possession, price, payment, delivery, risk, ijab-qabul, and supporting instruments.
3. Obtain qualified Legal review for relevant jurisdictions and competent Sharia review for the actual transaction. Record reviewer identity/authority, scope, source documents, decision, conditions, date, and validity.
4. Obtain Seller and Buyer acceptance of the final transaction-specific text through their authorized representatives.
5. Treat repository PR review/merge, legal approval, Sharia approval, party acceptance, and implementation authorization as separate decisions.
6. Any later promotion from DRAFT to FINAL requires a new, explicit, evidence-backed governance decision. No repository merge or generic “Approved” comment substitutes for that gate.

## 6. Implementation boundary

This record is documentation-only. It does not authorize:
- DDL or schema changes;
- SQL/Supabase migrations or database access;
- application or API implementation;
- payment activation or real-money movement;
- contract signing, goods release, deployment, or production release.

**Final disposition:** PR #132 remains historically merged. Its artifact remains DRAFT / NOT APPROVED. The governance discrepancy is resolved by preserving the event history and explicitly separating repository integration from transaction/legal/Sharia approval.
