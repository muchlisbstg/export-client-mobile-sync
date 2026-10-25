# Supply-chain lot traceability and operational workflow

**Status:** proposed MVP model. This document and the companion SQL are a design baseline, not proof that endpoints, integrations, physical facilities, or production controls already exist. Use synthetic data until security and migration tests pass.

## Goals and non-goals

Build traceability across plantation/supplier → packing house → warehouse → port/terminal using append-only lot history, inventory movements, quality gates, and handover evidence. The first increment is a domain/data model; it does not claim to automate customs clearance, carrier booking, weighbridge integrations, or Syariah/legal approvals.

## Core entities

| Entity | Purpose / key invariants |
|---|---|
| `supply_sites` | Tenant-owned operational location: plantation, supplier, packing house, warehouse, port terminal, transit, buyer. A site record does not imply a physical facility has been verified. |
| `supply_lots` | Traceable commodity unit with unique tenant-scoped lot code, product, origin, harvest/receipt dates, declared quantity/unit, status, creator, and origin evidence. |
| `lot_genealogy` | Parent-child edges for split, combine, process, repack, or reject; stores input/output quantity and units to reconcile yield/loss. |
| `inventory_movements` + `inventory_entries` | A movement header is idempotent; entries are signed quantity deltas per lot and site. Balances are derived from posted entries, never trusted from a client-supplied balance. |
| `quality_inspections` | Immutable inspection event with type, result, criteria, findings, corrective action, inspector, and evidence. A hold/fail blocks release/dispatch. |
| `handovers` | Transfer record from one site to another, with dispatch/receipt actors and times, quantity, carrier/container/seal references, discrepancies, and idempotency key. |
| `supply_evidence` | Evidence metadata with protected storage URI, SHA-256 digest when available, actor/time, metadata, and retention. Store files in controlled object storage, not directly in public URLs. |

Tenant isolation must be enforced server-side on every read/write, with composite tenant-scoped foreign keys as defense in depth. The caller's tenant ID is not authoritative; derive allowed tenant context from authenticated membership. Never allow a cross-tenant lot, site, movement, inspection, handover, or evidence reference.

## Lot and stock rules

1. Assign a unique, non-reusable lot ID and tenant-scoped lot code at receipt/harvest intake. Record commodity, origin site, harvest/receipt time, declared quantity and unit, and source evidence.
2. Treat each split/merge/processing/repack as a new child lot. Record parent-child edges and quantities in compatible units; record waste, moisture loss, rejects, or other yield differences explicitly rather than silently overwriting quantity.
3. Stock balance for a lot at a site = sum of posted signed entries for that tenant + lot + site. Use fixed precision integer base units (e.g., grams) or a documented decimal strategy in the production service; do not use binary floating point for financial or high-integrity quantity arithmetic.
4. A transfer is one database transaction: validate source balance and lot release status, create a draft movement, add source-negative and destination-positive entries, verify all affected balances remain nonnegative, then post. Any failure rolls back all entries. Corrections use compensating movements; never edit/delete posted ledger entries.
5. Idempotency keys are unique within a tenant. Replaying the same key and same payload returns the existing result; same key with different payload is a conflict.
6. A lot in `quarantined` or `blocked` state, or with an unresolved failed/hold inspection, cannot be dispatched. Only an authorized quality role can record release, with reason and evidence. A status label alone is not proof of approval.

## Operational state flow

```text
HARVEST / SUPPLIER RECEIPT
  -> create lot + origin evidence + receiving inspection
  -> pass: RELEASED / hold or fail: QUARANTINED
  -> PACKING HOUSE receipt and scale reconciliation
  -> grading / processing / packaging inspection
  -> create child batch(es) + genealogy + yield/loss reconciliation
  -> post stock transfer to warehouse location
  -> warehouse put-away / cycle count / quality hold checks
  -> prepare handover + seal/container + documents/evidence
  -> dispatch: decrement source stock, mark handover dispatched
  -> receiving confirmation: reconcile quantity and condition
  -> port gate-in / terminal receipt + gate ticket, weigh/VGM reference if applicable
  -> departure evidence and shipment/container references
```

A rejection, discrepancy, missing document, failed inspection, or seal mismatch moves the handover/shipment to an exception queue; it must not silently advance the happy path. The receiver should acknowledge receipt independently. Port-specific milestones should be configurable per corridor and cargo type, not hard-coded as universal customs requirements.

## Transaction boundaries

- **Lot creation:** validate site belongs to authorized tenant; store origin/quantity; attach evidence metadata; append audit event.
- **Receive stock:** in one SQLite transaction, insert movement header + positive entry + inspection/receipt link; reject duplicate idempotency key and invalid units.
- **Packing output:** record consumed input lots, produced output lot(s), rejects/waste, inspection, and genealogy in one atomic transaction; reconcile quantities by compatible units and defined tolerance.
- **Transfer/dispatch:** source and destination entries, handover status transition, and audit event must commit atomically. Never mark a handover dispatched if the stock decrement failed.
- **Receive handover:** verify destination, received quantity/unit, seal/container and condition; record discrepancy and evidence. If short/damaged, create an exception and reconcile through an approved adjustment/claim flow.
- **Quality decision:** inspection evidence is append-only. Release is a separate authorized action, not an edit to the inspection result.
- **Evidence upload:** authorize entity access before issuing a short-lived upload/download URL. Validate file type/size, malware scan as appropriate, hash content, record uploader and retention, and avoid sensitive content in application logs.

## Required APIs (next implementation increment)

| Method | Endpoint | Intent |
|---|---|---|
| POST | `/api/v1/supply/lots` | Create/receive lot with idempotency key |
| GET | `/api/v1/supply/lots/:lotId/trace` | Return upstream/downstream genealogy and events within tenant |
| POST | `/api/v1/supply/movements` | Create and post receipt/transfer/dispatch transaction |
| GET | `/api/v1/supply/stock?siteId=...` | Derived stock balance by lot/location |
| POST | `/api/v1/supply/lots/:lotId/inspections` | Record inspection outcome/evidence |
| POST | `/api/v1/supply/handovers` | Prepare handover and its evidence references |
| POST | `/api/v1/supply/handovers/:id/dispatch` | Atomically dispatch after all gates pass |
| POST | `/api/v1/supply/handovers/:id/receive` | Receiver confirms quantity/condition/seal |
| POST | `/api/v1/supply/evidence` | Register evidence metadata after authorized upload |

All write endpoints require authentication, server-side tenant membership/role checks, strict schemas, idempotency, rate limits, audit events, and stable error codes. These are proposed contracts; they do not exist until implemented and tested.

## Roles and approval gates

- **Farm/supplier operator:** submit harvest/receipt facts and evidence for assigned sites.
- **Packing operator:** receive, grade, process, and record yield.
- **Warehouse operator:** put-away, count, move, pick, and stage lots.
- **Quality inspector:** record findings; release/hold authority must be explicitly granted.
- **Dispatch/logistics operator:** prepare shipment and dispatch only released, available lots.
- **Receiving/terminal operator:** independently acknowledge handover and record exceptions.
- **Tenant admin/auditor:** manage scoped membership and inspect immutable histories; admin status must not bypass cross-tenant isolation.

## Acceptance criteria and tests

1. A synthetic lot can be traced from plantation to child packaging lot, warehouse, handover, and port event with actors, timestamps, quantity, and evidence references.
2. Splits/merges preserve parent-child links; quantity reconciliation reports yield/loss and rejects mismatched units or unexplained variance beyond configured tolerance.
3. Concurrent transfers cannot overspend stock; balances never become negative and a failed posting rolls back every entry.
4. Duplicate idempotency key + identical payload is safe; same key + different payload is rejected as conflict.
5. Quarantined, blocked, held, or failed-inspection lots cannot be picked/dispatched.
6. A handover cannot be marked dispatched before stock movement succeeds; receipt quantity/seal discrepancy creates an exception.
7. Cross-tenant read/write, unauthenticated access, role escalation, forged actor IDs, and evidence URL access are rejected.
8. Migration is idempotent, preserves existing inquiry/tenant records, passes SQLite integrity and foreign-key checks on an isolated representative copy, and never assigns ambiguous legacy records to arbitrary tenants.
9. CI evidence must identify the exact commit SHA and individual job outcomes. No green status is assumed from the presence of tests alone.

## Rollout boundary

Phase 1 is schema + domain tests using synthetic records. Phase 2 is repository-backed service/API implementation and negative security tests. Phase 3 is mobile UI and controlled integrations. Phase 4 is operational pilot with verified facilities, trained users, retention, backups, monitoring, and human go-live approval. No real customer data, live logistics integrations, production deployment, or compliance/certification claim is implied by this proposal.
