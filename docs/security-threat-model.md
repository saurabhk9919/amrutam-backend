# Amrutam Telemedicine Backend — Security Threat Model

## 1. Purpose and Scope

This document identifies security threats to the Amrutam Telemedicine Backend, including authentication, authorization, appointment booking, prescriptions, audit logging, and operational monitoring.

The assessment considers the current Node.js, Express.js, PostgreSQL, and Prisma architecture. It distinguishes implemented controls from additional measures required before production deployment.

## 2. Assets to Protect

| Asset | Security concern |
|---|---|
| User accounts | Account takeover and unauthorized access |
| Password hashes and JWTs | Credential theft and impersonation |
| Patient and consultation records | Unauthorized disclosure or modification |
| Prescriptions | Unauthorized creation or alteration |
| Doctor verification status | Fraudulent provider verification |
| Booking records | Duplicate bookings and appointment manipulation |
| Audit logs | Tampering and loss of accountability |
| Database credentials and JWT secrets | Infrastructure compromise |
| Monitoring data | Information disclosure and operational abuse |

## 3. Trust Boundaries

1. **Client to API:** All incoming requests are untrusted and require validation.
2. **API to database:** Database operations must enforce integrity, authorization rules, and transactional consistency.
3. **Authentication boundary:** JWT verification establishes the caller's identity; role and resource-level checks determine what they may access.
4. **Operational boundary:** Logs and metrics should be available only to authorized operational personnel or monitoring systems.
5. **Deployment boundary:** Secrets and production configuration must be protected from source control and unauthorized access.

## 4. Threats and Mitigations

| Threat | Potential impact | Current controls | Remaining work |
|---|---|---|---|
| Password theft | Account takeover | bcrypt password hashing | Apply password policy and login abuse monitoring |
| Forged or expired tokens | Unauthorized API access | JWT verification and expiry | Protect JWT secrets and establish rotation procedures |
| Privilege escalation | Unauthorized administrative actions | Role validation and role-based middleware | Establish a controlled admin provisioning process |
| Broken object-level authorization | Exposure of another user's consultation | Service-level access checks for patient, doctor, and admin | Add comprehensive negative authorization tests |
| Duplicate booking or race condition | Double-booked appointment | Transactions, conditional slot updates, and idempotency keys | Run concurrent booking integration tests |
| Invalid input | Unexpected behavior or data corruption | Zod validation and request-size limit | Validate all query parameters and identifiers consistently |
| Brute-force requests | Service abuse or account attacks | Express rate limiting | Consider stricter authentication-specific limits |
| Sensitive data in logs | Exposure of credentials or patient information | Pino redaction of configured sensitive fields | Review every log field and restrict log access |
| Metrics endpoint exposure | Operational information disclosure | Metrics instrumentation exists | Restrict `/metrics` to trusted monitoring infrastructure |
| Database outage | API failures | Readiness probe and error handling | Configure backups, recovery tests, and database monitoring |
| Audit event loss | Reduced accountability | Transactional audit writes for selected workflows | Define retention, access controls, and tamper-resistant storage |
| Dependency vulnerability | Exploitation of vulnerable packages | Dependency audit and lockfile | Run regular audits and verify dependency compatibility |

## 5. Authorization Model

The API uses three roles:

- **PATIENT:** Can book appointments and access consultations and prescriptions permitted by the resource-level rules.
- **DOCTOR:** Can create availability and access consultations assigned to that doctor, subject to service-level restrictions.
- **ADMIN:** Can verify doctors and access administrative consultation analytics.

Authentication alone is not sufficient for access. Each protected operation must also check the user's role and, where applicable, ownership or assignment of the requested resource.

Public registration must not allow users to assign themselves the ADMIN role.

## 6. Booking Integrity and Idempotency

Booking is a high-risk operation because concurrent requests can target the same slot.

The implementation uses an idempotency key to identify retries, stores the request hash and response, and conditionally changes a slot from OPEN to BOOKED within a transaction. This helps prevent duplicate processing and conflicting bookings.

Required additional verification includes concurrent integration tests, idempotency-key expiration and retention policy, and recovery behavior for interrupted requests.

## 7. Logging and Auditability

The application generates request IDs and uses structured Pino logging. Configured sensitive fields, including authorization headers, cookies, passwords, password hashes, and tokens, are redacted.

Selected critical operations create audit records, including consultation status changes, prescription creation, and doctor verification. Audit writes are transactional with the relevant business operation where implemented.

Production controls should define log retention, access permissions, alerting, and protection against unauthorized audit-log modification.

## 8. Production Security Checklist

### Application
- [ ] Enforce HTTPS at the public ingress.
- [ ] Keep `.env` and credentials out of source control.
- [ ] Store production secrets in an approved secret manager.
- [ ] Restrict `/metrics` to trusted monitoring infrastructure.
- [ ] Review CORS origins and authentication rate limits.
- [ ] Verify authorization for every sensitive resource.
- [ ] Avoid logging patient data, credentials, or tokens.

### Database
- [ ] Use a dedicated least-privilege database account.
- [ ] Restrict network access to the database.
- [ ] Encrypt database connections and backups where applicable.
- [ ] Establish backup retention and test restoration.
- [ ] Apply schema migrations through a controlled deployment process.

### Operations
- [ ] Monitor API errors, latency, database health, and failed authentication.
- [ ] Establish dependency scanning and patching procedures.
- [ ] Test graceful shutdown and recovery behavior.
- [ ] Run security, integration, and concurrent booking tests.
- [ ] Document incident response and credential rotation procedures.

## 9. Residual Risks and Limitations

This threat model documents the application's known controls and recommended production measures. It does not constitute a penetration-test report or prove that the system is production-secure.

Controls in the checklist must be verified in the actual deployment before being marked complete. The security of the system also depends on infrastructure configuration, secret handling, database permissions, and operational practices.

## 10. Review Process

Review this threat model whenever authentication, authorization, sensitive data handling, database design, deployment infrastructure, or external integrations change. Record significant findings and track remediation through issues or pull requests.
