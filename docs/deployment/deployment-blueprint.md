# Deployment Blueprint — Budget-Gated, No Redesign

**Repository:** `muchlisbstg/export-client-mobile-sync`  
**Architecture baseline:** `main` at `73e75edad71c5a6f8819e80c5ffdeabf32314c3d`  
**Status:** Target blueprint only. No infrastructure is provisioned, no service is deployed, and no provider spend is authorized.

## 1. Product delivery topology

```text
Android / iOS (Expo SDK 58)       Web (Expo static export)
             \                    /
              \                  /
               HTTPS API origin
                      |
             Node.js / Express API
                      |
       PostgreSQL (target transactional DB)
          |             |             |
      Auth context   Outbox worker  Audit trail
          |             |             |
     Supabase Auth   Peer sync      Evidence storage
```

The mobile and browser clients remain presentation/API clients. They must not connect directly to privileged database credentials or make authorization decisions. All enterprise, role, transaction, and site checks remain server-side.

## 2. Current state versus target

| Layer | Current source/evidence | Target when budget is approved |
|---|---|---|
| Android / iOS | Expo SDK 58; CI can export Android JS bundle and build an unsigned iOS Simulator artifact | Signed Android/iOS release artifacts, store submission, device E2E, release approval |
| Web | Expo Metro static export to `dist/` | Static hosting/CDN with immutable assets, HTTPS, environment-specific API origin |
| API | Node.js + Express 5, `better-sqlite3`, default loopback bind, local SQLite path | Long-running Node container/service behind TLS reverse proxy; health/readiness separated; no stateless SQLite-on-serverless deployment |
| Identity | Supabase Auth integration in API/client | Separate production Auth project; short-lived user sessions; backend verifies token and derives enterprise/role/site access |
| Data | SQLite source model; physical deployed DB path is not verified | PostgreSQL as target for multi-instance/global operations after schema blockers are resolved and migration is approved |
| Evidence | Evidence records reference URI/hash metadata | Private object storage with signed, time-limited access, retention policy, malware/content validation |
| Sync | SQLite outbox and configured peer sync code | Durable outbox worker, bounded retries, idempotency, peer allowlist, replay protection, operational monitoring |
| Delivery | GitHub Actions build/test/artifact workflows | CI → reviewer gates → approved artifact promotion → manual deployment with rollback |

## 3. Hosting decision principles

- No new Hostinger VPS, AWS, or other paid infrastructure is required for the current engineering phase.
- Keep GitHub Actions as the no-cost validation and artifact-generation control plane within available quotas.
- Do not assume a current Vercel project is hosting the Express API. The repository's current static Web export is an artifact, not proof of an API deployment.
- Do not run the current SQLite API as a stateless serverless function. SQLite WAL and local disk require a stable writable persistent volume and single-writer operational model.
- For a low-cost first production footprint, a single long-running API instance with durable encrypted storage can be considered only after operational controls and budget approval. Do not horizontally scale SQLite.
- For global multi-instance operation, use PostgreSQL as the authoritative transactional database and move sync/outbox processing to durable workers. The existing Supabase staging project is not production and must not be promoted implicitly.

## 4. Environment separation

Maintain distinct environments and credentials:

1. **Local/CI:** disposable synthetic SQLite databases; no production credentials.
2. **Staging:** existing dedicated Supabase staging project; synthetic fixtures only; no schema DDL until Security + Database approval.
3. **Production:** separate production Auth/database/storage credentials; not created or configured yet.

Never place database passwords, Supabase service-role keys, sync secrets, signing keys, or provider credentials in Expo `EXPO_PUBLIC_*` variables or mobile/web bundles. Client-visible variables are public by design.

## 5. API and data-plane requirements

- HTTPS/TLS for all non-loopback traffic.
- Explicit CORS origin allowlist per environment.
- Reverse proxy must preserve request identity safely; do not trust arbitrary forwarded headers.
- API process runs as non-root with least-privilege filesystem access.
- Database and object storage credentials are injected from the host secret manager.
- Database backups are encrypted, off-host, monitored, and restore-tested.
- Health endpoint remains minimal liveness; readiness and operational diagnostics are private/authenticated.
- Outbox worker uses idempotent delivery, bounded retry/backoff, dead-letter visibility, and restart recovery.
- Structured logs redact PII, bearer tokens, passwords, sync secrets, and document contents.
- Rate limits are verified against the actual proxy topology.

## 6. Security, database, and Syariah release gates

A production release requires all of the following, independently recorded:

- Security reviewer accepts endpoint authorization, role/site matrix, CORS, secret handling, rate limits, audit behavior, and negative tests.
- Database reviewer accepts physical schema provenance, relational integrity, RLS/privilege model, migration plan, backup/restore, and rollback.
- Legal and Syariah advisors approve the applicable akad, commercial contract lifecycle, fee/commission model, payment terms, money movement, and evidence/record retention before payment functionality is enabled.
- Product owner approves the exact commit SHA and immutable artifacts.
- Functional E2E passes with wholly synthetic identities, buyer/seller/supplier/warehouse/QC/logistics/auditor roles, and cross-site denial.
- No customer/operational data is copied into staging under the current authorization.

## 7. Deployment sequence when funding is available

1. Confirm provider, region, data residency, monthly cost, backups, and operational owner.
2. Provision isolated staging infrastructure with explicit human approval.
3. Complete physical schema extraction and source-vs-runtime reconciliation.
4. Resolve the five transaction/site relational blockers; obtain Security and Database approvals before creating/applying migrations.
5. Implement and test PostgreSQL adapter, transaction boundaries, RLS, connection-pool identity isolation, and outbox worker.
6. Deploy API to staging with synthetic data; run API, Web, Android, iOS, sync, backup/restore, and resilience tests.
7. Complete Security, Database, Legal, and Syariah review; record exact SHA and artifact digests.
8. Owner manually approves production deployment; take verified backup; apply approved migration; deploy API and clients in a controlled sequence.
9. Run post-deploy smoke tests and monitor error rate, sync backlog, audit failures, database health, and storage.
10. Roll back to the last known-good immutable artifact and restore only through the approved recovery procedure.

## 8. Rollback and continuity

- Keep API and client artifacts immutable and tagged by commit SHA.
- Database changes must be backward-compatible where possible; destructive migrations require a separately approved recovery plan.
- Maintain tested encrypted backups and a documented RPO/RTO before production data is accepted.
- Do not roll back by deleting or rewriting financial, inventory, or audit history.
- If a release fails, disable new writes or revert the application artifact while preserving durable data and audit history.

## 9. Current non-goals

No provider account purchase, VPS creation, AWS provisioning, DNS cutover, TLS issuance, database migration, Supabase staging mutation, production secret creation, production deployment, App Store submission, Play Store submission, or payment activation is part of this blueprint.
