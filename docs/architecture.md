# Amrutam Telemedicine Backend — Architecture

## 1. Overview

The Amrutam Telemedicine Backend is a RESTful API that supports patient and doctor registration, doctor availability, appointment booking, consultations, prescriptions, and administrative workflows.

The application is built using Node.js and Express.js, with PostgreSQL as the primary relational database and Prisma ORM for database access. JWT-based authentication and role-based authorization protect restricted endpoints.

The system also includes structured logging, Prometheus metrics, readiness checks, automated tests, CI, and OpenAPI documentation.

## 2. Technology Stack

| Component | Technology | Responsibility |
|---|---|---|
| Runtime | Node.js | Server-side JavaScript execution |
| API framework | Express.js | Routing and HTTP middleware |
| Database | PostgreSQL | Persistent application data |
| ORM | Prisma | Database queries and transactions |
| Authentication | JWT and bcrypt | Token-based authentication and password hashing |
| Validation | Zod | Request validation |
| Security middleware | Helmet, CORS, express-rate-limit | HTTP security headers, cross-origin policy, and request limiting |
| Logging | Pino and pino-http | Structured application and HTTP logs |
| Monitoring | prom-client | Prometheus metrics |
| API documentation | OpenAPI 3.0.3 and Swagger UI | API specification and interactive documentation |
| Testing | Jest and Supertest | Automated unit and HTTP tests |
| CI | GitHub Actions | Automated verification |

## 3. High-Level Architecture

```text
                 Client Applications
                         |
                         v
                  Express.js API
                         |
          +--------------+--------------+
          |              |              |
          v              v              v
    Middleware       API Routes      Observability
    - Request ID     - Auth          - Pino logs
    - Helmet         - Availability  - HTTP metrics
    - CORS           - Bookings
    - Rate limit     - Consultations
    - JSON parsing   - Prescriptions
                     - Admin
                         |
                         v
                   Service Layer
                         |
                         v
                    Prisma ORM
                         |
                         v
                    PostgreSQL
```

The diagram represents the logical architecture. Monitoring, CI, and API documentation are supporting capabilities rather than separate request-processing services.

## 4. Main Modules

### Authentication

Supports registration, login, and retrieval of the authenticated user's profile. Passwords are hashed using bcrypt, and successful login returns a JWT.

Public registration permits patient and doctor roles. Administrative privileges must be provisioned through a controlled process rather than public registration.

### Availability and Booking

Doctors can create availability slots. Patients can book available slots using an idempotency key.

Booking logic uses database transactions and conditional slot updates to help prevent two patients from booking the same slot. Idempotency records allow retries to return the previously stored result for the same user and key.

### Consultations and Prescriptions

Users can access consultations according to their roles and relationships to each consultation. Consultation status changes follow defined transition rules and are audited.

Prescription creation is restricted to the assigned doctor and an eligible completed consultation. Prescription creation and its audit record are handled transactionally.

### Administration

Administrators can verify doctors and retrieve consultation analytics for an optional date range. Doctor verification records an audit event, and repeating verification does not create another verification event.

## 5. Data Model

The Prisma schema contains the following principal models:

- **User:** account identity, email, password hash, and role.
- **Profile:** user profile information.
- **Doctor:** doctor-specific information and verification status.
- **AvailabilitySlot:** doctor availability and slot status.
- **Consultation:** patient, doctor, appointment, and consultation status.
- **Prescription:** prescription associated with a consultation.
- **Payment:** payment status and related payment information.
- **AuditLog:** actor, action, entity, request ID, and metadata.
- **IdempotencyKey:** booking request identity and stored response.
- **OutboxEvent:** persistent event-processing state.

PostgreSQL stores persistent application data. Prisma provides database access and transaction support. Database constraints, indexes, and conditional updates support integrity and concurrent operations.

## 6. Security and Access Control

- Passwords are stored as bcrypt hashes, not plaintext.
- JWTs authenticate protected requests.
- Middleware enforces role-based access to restricted routes.
- Zod validates supported request payloads.
- Helmet adds HTTP security headers.
- Express rate limiting restricts request frequency.
- The JSON request body is limited to 100 KB.
- Pino redacts configured sensitive fields from logs.
- Request IDs support correlation between HTTP logs and audit events.
- Consultation status changes, prescription creation, and doctor verification produce audit records.

Production deployment must also protect secrets, use HTTPS, restrict monitoring endpoints, and apply appropriate database permissions and backup policies.

## 7. Reliability and Observability

### Health and readiness

- `GET /health` reports whether the application process is running.
- `GET /ready` checks database connectivity using `SELECT 1`.
- `GET /metrics` exposes Prometheus metrics.

### Metrics and logging

The observability module records HTTP request counts and request duration, labeled by method, parameterized route, and response status. Default Node.js process metrics are also registered.

Structured logs include request correlation information. The server handles shutdown signals and disconnects Prisma during graceful shutdown.

### Error handling

The application centralizes error handling and maps Prisma unique-constraint conflicts to HTTP 409 responses. Readiness failures return HTTP 503.

## 8. Performance and Scaling Strategy

The current architecture is a modular Node.js API backed by PostgreSQL. The following measures support its performance and provide a path to scale:

- Use indexes aligned with frequent consultation and availability queries.
- Use transactions and conditional database updates for booking integrity.
- Use idempotency keys to make booking retries safe.
- Keep API response payloads bounded and validate incoming requests.
- Measure request latency and database performance before optimizing.
- For deployment at higher traffic, run multiple stateless API instances behind a load balancer and configure PostgreSQL connection pooling.
- Introduce Redis caching or asynchronous workers only where measured requirements justify them.

The assessment targets of 100,000 daily consultations, p95 read latency below 200 ms, p95 write latency below 500 ms, and 99.95% availability are design goals, not verified production results. Load testing, capacity planning, deployment redundancy, and operational monitoring are required to demonstrate those targets.

## 9. Deployment and CI

GitHub Actions runs the automated test suite and coverage checks. The application is designed to use environment variables for configuration and secrets.

A production deployment should include automated migrations, container image management, secure secret injection, health-based traffic routing, backups, and a rollback strategy. These deployment controls should be documented as implemented only when they are actually configured.

## 10. Known Limitations and Future Work

- Restrict `/metrics` to trusted monitoring infrastructure before public production deployment.
- Review the OpenAPI schemas against all runtime validation rules.
- Add integration and load tests against a representative database environment.
- Establish production alerting, backup recovery tests, and deployment rollback procedures.
- Evaluate Redis caching and asynchronous workers based on measured bottlenecks.
- Complete a formal threat model and verify production secret-management practices.
