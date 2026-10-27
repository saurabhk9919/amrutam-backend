const pino = require("pino");
const client = require("prom-client");

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "password",
      "passwordHash",
      "token",
    ],
    censor: "[REDACTED]",
  },
});

const metricsRegistry = new client.Registry();

client.collectDefaultMetrics({
  register: metricsRegistry,
  prefix: "amrutam_",
});

const httpRequestsTotal = new client.Counter({
  name: "amrutam_http_requests_total",
  help: "Total HTTP requests handled by the API",
  labelNames: ["method", "route", "status_code"],
  registers: [metricsRegistry],
});

const httpRequestDuration = new client.Histogram({
  name: "amrutam_http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.2, 0.5, 1, 2, 5],
  registers: [metricsRegistry],
});

function httpMetricsMiddleware(req, res, next) {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const durationSeconds =
      Number(process.hrtime.bigint() - start) / 1e9;

    // Use route templates, not raw URLs, to avoid high-cardinality labels.
    const route = req.route
      ? `${req.baseUrl || ""}${req.route.path}`
      : "unmatched";

    const labels = {
      method: req.method,
      route,
      status_code: String(res.statusCode),
    };

    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, durationSeconds);
  });

  next();
}

async function getMetrics() {
  return metricsRegistry.metrics();
}

module.exports = {
  logger,
  metricsRegistry,
  httpMetricsMiddleware,
  getMetrics,
};
