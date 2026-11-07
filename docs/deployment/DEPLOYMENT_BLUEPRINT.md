# Deployment Blueprint — Android, iOS, Web and API

**Status:** Budget-gated planning only. No infrastructure, domain, DNS, secrets, database, or deployment changes are authorized.  
**Product posture:** Indonesia-first with international export readiness; single-enterprise operating model; financial workflows remain disabled/demo-only until Legal and Sharia approval.

## 1. Target topology

- **Mobile:** Expo SDK 58 application; Android and iOS validated and released as separate artifacts.
- **Web:** Expo Web static export served from a managed HTTPS web origin.
- **API:** Independently deployed Node.js service behind HTTPS reverse proxy/load balancer.
- **Database:** Managed PostgreSQL for production target; isolated disposable database for CI and integration validation.
- **Object storage:** Private bucket/container for export, QC, shipping, and compliance documents; short-lived signed access and malware/content validation.
- **Identity:** Supabase Auth or approved identity provider; server-side authorization remains authoritative.
- **Observability:** Structured redacted logs, audit events, health/readiness checks, error monitoring, backup monitoring and alerting.
- **Delivery:** GitHub Actions builds and validates; human-approved release pipeline performs any later deployment.

## 2. Environment separation

| Environment | Purpose | Data | Release controls |
|---|---|---|---|
| Local / CI | Unit, contract, build validation | Synthetic fixtures | No production secrets |
| Isolated integration | PostgreSQL FK/RLS, API and cross-platform integration | Synthetic/sanitized only | Ephemeral and disposable |
| Staging | End-to-end pre-release validation | Approved synthetic data | Explicit environment authorization |
| Production | Live business operations | Governed business data | Separate owner approval, backup and rollback plan |

Do not create a staging or production resource until budget, region, data residency, retention, backup, access and security requirements are approved.

## 3. Platform delivery gates

### Android
- SDK/dependency compatibility and reproducible lockfile install.
- Signed AAB/APK pipeline with protected signing material outside repository.
- Device matrix, login/session, API connectivity, offline/retry, permissions, file and share behavior.
- Play Console internal testing before staged rollout.

### iOS
- SDK/native compatibility and reproducible Xcode build.
- Signing certificates/profiles stored in approved secret management.
- Simulator smoke test plus physical-device checks for native capabilities.
- TestFlight validation before phased App Store release.

### Web
- Static export and artifact integrity.
- HTTPS origin, CSP/security headers, browser routing/refresh and cache policy.
- CORS allowlist for exact deployed origins, methods and headers.
- Browser tests for login/session, API token propagation, file upload/download, share fallback and refresh.
- No loopback/default development API URL in a release build.

Each platform must have its own candidate SHA, CI evidence, runtime validation and release approval.

## 4. API and configuration contract

- Bind API to the host interface required by the approved platform, not an accidental development-only loopback.
- Configure a stable HTTPS API origin; mobile and web clients must not default to `127.0.0.1` in release builds.
- Keep CORS origins explicit and environment-specific.
- Validate authentication token audience/issuer/expiry and authorize enterprise, role, site, object and state transition server-side.
- Never expose service-role credentials or database credentials to client bundles.
- Store configuration values in environment/secret management; documentation records variable names, never secret values.

## 5. Indonesia and international operating considerations

Before selecting a hosting region, document data categories, data subjects, cross-border transfers, retention, backups, subprocessors, incident handling and applicable Indonesian and destination-market obligations. Region choice is a legal/security decision, not an assumed default.

Trade/export workflows must preserve origin traceability, product classification, QC, packing, shipping and document provenance. Legal review is required for each relevant jurisdiction and transaction model.

## 6. Financial and Sharia controls

Do not activate real-money collection, custody, settlement, FX, financing, guarantees, penalties or fee flows until the actual akad and end-to-end money flow are reviewed. The design must identify parties, ownership/possession, risk transfer, pricing, fees, settlement, refunds, default and intermediaries. Qualified Legal and Sharia reviewers must approve the exact version. Engineering cannot infer compliance from a payment rail or akad label.

## 7. Cost and rollout strategy

Current hosting budget is not approved. Therefore:
1. Complete code, CI, synthetic integration and deployment documentation without provisioning paid infrastructure.
2. Produce a costed options comparison when budget planning is requested.
3. Select provider/region only after data governance and operational requirements are signed off.
4. Provision a non-production environment only with explicit budget and environment approval.
5. Run a controlled pilot with synthetic or approved limited data.
6. Production launch requires separate release owner approval and tested rollback/backup evidence.

## 8. Operational readiness checklist

- [ ] Hosting provider, region and cost approved.
- [ ] Data residency, privacy, retention and cross-border assessment approved.
- [ ] API, database and object-storage architecture reviewed.
- [ ] Network, TLS, secrets and identity controls reviewed.
- [ ] Backup restore and disaster recovery tested.
- [ ] Monitoring, incident response and support ownership defined.
- [ ] Android, iOS and Web exact-SHA gates approved independently.
- [ ] Security and Database reviews approved.
- [ ] Legal and Sharia approvals recorded for applicable flows.
- [ ] Release owner authorizes the specific deployment.

No item in this blueprint is evidence that infrastructure exists or that a deployment has occurred.
