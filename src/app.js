require("dotenv").config({ quiet: true });

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const pinoHttp = require("pino-http");

const prisma = require("./config/database");
const {
  logger,
  metricsRegistry,
  httpMetricsMiddleware,
} = require("./config/observability");

const authRoutes = require("./modules/auth/auth.routes");
const availabilityRoutes = require("./modules/availability/availability.routes");
const bookingRoutes = require("./modules/bookings/booking.routes");
const consultationRoutes = require("./modules/consultations/consultations.routes");
const prescriptionRoutes = require("./modules/prescriptions/prescription.routes");
const adminRoutes = require("./modules/admin/admin.routes");

const {
  requestIdMiddleware,
} = require("./middleware/request-id.middleware");

const app = express();

app.disable("x-powered-by");

app.use(requestIdMiddleware);

app.use(
  pinoHttp({
    logger,
    genReqId: (req) => req.requestId,
    customProps: (req) => ({
      requestId: req.requestId,
    }),
  })
);

app.use(httpMetricsMiddleware);
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "100kb" }));

// Apply rate limiting before API routes.
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  })
);

// Liveness: the process is running.
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "amrutam-telemedicine-backend",
  });
});

// Readiness: the application can reach PostgreSQL.
app.get("/ready", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return res.status(200).json({
      status: "ready",
      database: "connected",
    });
  } catch (error) {
    req.log.error(
      { err: error, requestId: req.requestId },
      "Readiness check failed"
    );

    return res.status(503).json({
      status: "not_ready",
      database: "unavailable",
    });
  }
});

// Metrics should be exposed only to trusted monitoring infrastructure
// in production, using network restrictions or an authenticated scrape path.
app.get("/metrics", async (req, res, next) => {
  try {
    res.set("Content-Type", metricsRegistry.contentType);
    return res.status(200).send(await metricsRegistry.metrics());
  } catch (error) {
    return next(error);
  }
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/availability", availabilityRoutes);
app.use("/api/v1/bookings", bookingRoutes);
app.use("/api/v1/consultations", prescriptionRoutes);
app.use("/api/v1/consultations", consultationRoutes);
app.use("/api/v1/admin", adminRoutes);

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  req.log?.error(
    { err, requestId: req.requestId },
    "Request failed"
  );

  if (err.code === "P2002") {
    return res.status(409).json({
      error: "Resource conflicts with an existing record",
    });
  }

  const statusCode = err.statusCode || 500;

  return res.status(statusCode).json({
    error: err.statusCode
      ? err.message
      : "Internal server error",
  });
});

module.exports = app;
