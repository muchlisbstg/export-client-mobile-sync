# Production Readiness Checklist

This application is an MVP/demo. Green CI is not a production security certification. Do not process real customer data until applicable items are implemented, tested, reviewed, and approved.

## P0 — Identity, access, and privacy

- [ ] Define user identity, roles, tenant boundaries, and administrator permissions.
- [ ] Enforce authentication and authorization on all private/admin APIs; the peer sync bearer secret is service-to-service authentication, not user login.
- [ ] Review public tracking: treat tracking codes as bearer credentials, minimize returned fields, and monitor abuse.
- [ ] Define purpose, retention, export, correction, and deletion rules for names, email addresses, inquiry records, and conflict logs.
- [ ] Review storage, logs, backups, crash reports, and device/desktop files for PII exposure; document encryption and key management as appropriate.

## P0 — Network and synchronization

- [ ] Keep the API bound to loopback by default. If LAN access is required, enable it explicitly on a trusted network and restrict inbound firewall rules.
- [ ] Use HTTPS/TLS for all non-loopback traffic; do not send sync secrets over plain HTTP.
- [ ] Store service secrets outside source control and client bundles; document rotation and revocation.
- [ ] Verify peer identity and test missing/invalid secrets, peer outages, retry/backoff, duplicate replay, conflicting IDs/tracking codes, and restart recovery.
- [ ] Ensure rate limiting works behind the actual proxy topology and cannot be bypassed by untrusted forwarded headers.

## P1 — Reliability and operations

- [ ] Document database location, migrations, backup frequency, encrypted off-host storage, restore drills, RPO/RTO, and SQLite integrity checks.
- [ ] Add structured, redacted logs and monitoring for API errors, sync backlog/retry age, conflicts, disk space, and process health.
- [ ] Test upgrades and persistence paths on every supported operating system/device type.
- [ ] Run dependency, secret, static-analysis, and vulnerability checks in CI; triage findings rather than treating a green build as a security review.
- [ ] Add staging smoke tests with synthetic data and an incident/rollback runbook.

## Release gates

- [ ] All unit/integration, typecheck, build, and three-backend interoperability checks pass.
- [ ] Backup/restore and peer-outage recovery drills pass with synthetic data.
- [ ] Security/privacy review is recorded and all blockers are resolved.
- [ ] A human owner approves the exact commit/artifact before release.
- [ ] Deployment and rollback are documented; no release is implied by this checklist.

## Explicit current limitations

The MVP does not provide end-user login, admin authorization, complete retention/deletion workflows, or a production deployment. The checklist documents work still required; it does not claim those controls already exist.
