# Amrutam Telemedicine Backend

A RESTful backend for a telemedicine platform, built with Node.js, Express, PostgreSQL, and Prisma. The project focuses on secure authentication, role-based access control, doctor availability, consultation booking, prescriptions, audit logging, and operational observability.

## Key Features

- **Authentication:** User registration, login, password hashing with bcrypt, and JWT-based authentication.
- **Role-based access control:** Separate permissions for patients, doctors, and administrators.
- **Doctor availability:** Create and retrieve appointment availability slots.
- **Consultation booking:** Transactional booking logic, slot availability checks, and idempotency-key support to help prevent duplicate bookings.
- **Consultation management:** Retrieve consultations and manage permitted status transitions.
- **Prescriptions:** Role- and resource-based authorization for prescription operations.
- **Administration:** Doctor verification and consultation analytics.
- **Audit logging:** Record important operations for traceability.
- **API documentation:** OpenAPI specification and Swagger UI.
- **Observability:** Structured logging, HTTP metrics, health checks, and readiness checks.
- **Security controls:** Helmet, CORS configuration, request-size limits, input validation, and rate limiting.
- **Automated tests:** Jest and Supertest.

## Technology Stack

| Component | Technology |
|---|---|
| Runtime | Node.js |
| API framework | Express |
| Language | JavaScript (CommonJS) |
| Database | PostgreSQL |
| ORM | Prisma |
| Authentication | JWT and bcrypt |
| Validation | Zod |
| Logging | Pino and pino-http |
| Metrics | prom-client |
| API documentation | OpenAPI and Swagger UI |
| Testing | Jest and Supertest |
| Security middleware | Helmet and express-rate-limit |

## Project Structure

```text
amrutam-backend/
├── .github/                 # CI workflows
├── docs/
│   ├── architecture.md      # Architecture overview
│   └── security-threat-model.md
├── infra/                   # Infrastructure configuration
├── monitoring/              # Monitoring configuration
├── openapi/
│   └── openapi.yaml         # OpenAPI specification
├── prisma/
│   └── schema.prisma        # Database schema
├── src/
│   ├── config/              # Configuration and observability
│   ├── modules/             # Feature modules
│   ├── app.js               # Express application
│   └── server.js            # Server startup and shutdown
├── tests/                   # Automated tests
├── .env.example             # Environment variable template
├── package.json
└── README.md
```

## Prerequisites

Install the following before running the application:

- Node.js and npm
- PostgreSQL
- Git

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/saurabhk9919/amrutam-backend.git
cd amrutam-backend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a local `.env` file using `.env.example` as a reference. Configure the database connection string and the authentication settings required by the application.

Typical variables include:

```dotenv
PORT=3000
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/amrutam"
JWT_SECRET="replace-with-a-strong-random-secret"
```

These names and example values must match the application's actual configuration. Use a strong, unique JWT secret and never commit `.env` or real credentials to Git.

### 4. Set up the database

Ensure PostgreSQL is running and the configured database exists.

Generate the Prisma Client:

```bash
npx prisma generate
```

Apply committed migrations:

```bash
npx prisma migrate deploy
```

For local development, if you are creating a new migration, use:

```bash
npx prisma migrate dev --name describe_your_change
```

### 5. Start the server

Development mode with automatic restarts:

```bash
npm run dev
```

Standard startup:

```bash
npm start
```

The server uses the configured `PORT`. If it defaults to port 3000, the local base URL is:

`http://localhost:3000`

## API Documentation

Once the server is running, open:

`http://localhost:3000/api-docs`

Swagger UI provides an interactive interface for exploring the API and trying supported requests.

The OpenAPI specification is available in [`openapi/openapi.yaml`](openapi/openapi.yaml).

### Main API Routes

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v1/auth/register` | Register a patient or doctor |
| POST | `/api/v1/auth/login` | Authenticate a user |
| GET | `/api/v1/auth/me` | Get the authenticated user's profile |
| GET | `/api/v1/availability` | Retrieve available appointment slots |
| POST | `/api/v1/availability` | Create doctor availability |
| POST | `/api/v1/bookings` | Book an appointment |
| GET | `/api/v1/consultations` | Retrieve permitted consultations |
| GET | `/api/v1/consultations/:id` | Retrieve a consultation |
| PATCH | `/api/v1/consultations/:id/status` | Update consultation status |
| POST | `/api/v1/consultations` | Create a prescription, subject to authorization |
| GET | `/api/v1/consultations/:id/prescription` | Retrieve a prescription, subject to authorization |
| PATCH | `/api/v1/admin/doctors/:doctorId/verify` | Verify a doctor as an administrator |
| GET | `/api/v1/admin/analytics/consultations` | Retrieve consultation analytics |

Protected endpoints require a valid bearer token unless otherwise specified. See Swagger UI for request schemas, response formats, and role requirements.

For booking requests, provide an `Idempotency-Key` header as required by the API.

## Health and Observability

| Endpoint | Purpose |
|---|---|
| `GET /health` | Basic application health check |
| `GET /ready` | Readiness check, including database connectivity |
| `GET /metrics` | Prometheus-compatible application and process metrics |

The application uses Pino for structured logging and Prometheus metrics for request counts and response-duration measurements.

**Deployment note:** Restrict access to `/metrics` to trusted monitoring infrastructure in production. Review rate limits, CORS origins, secrets management, database access, and deployment health checks before exposing the service publicly.

## Testing

Run the automated test suite:

```bash
npm test
```

Run tests with coverage reporting:

```bash
npm run test:coverage
```

Tests should be run against the appropriate test configuration and database. Do not point destructive test setup at a production database.

## Security and Architecture

Additional documentation:

- [Architecture Overview](docs/architecture.md)
- [Security Threat Model](docs/security-threat-model.md)
- [OpenAPI Specification](openapi/openapi.yaml)

Security-related implementation includes password hashing, JWT authentication, role-based authorization, request validation, rate limiting, audit logging, and transactional handling of critical booking operations.

## Engineering Considerations

- Booking uses database transactions and conditional slot updates to reduce double-booking risk.
- Idempotency support helps clients safely retry supported booking requests.
- Structured logs redact selected sensitive fields.
- Health and readiness endpoints support operational checks.
- Performance and availability targets require deployment-specific load testing and monitoring before they can be considered verified.

## Future Improvements

Potential production-hardening work includes:

- Load and concurrency testing against the target SLOs.
- Restricting metrics access to trusted infrastructure.
- Centralized secrets management and key rotation.
- Distributed tracing and alerting integration.
- Backup and restore testing.
- Deployment automation and rollback verification.
- Multi-factor authentication where required.

## License

The repository currently declares the ISC license in `package.json`. Confirm the intended project licensing before distributing the project.
