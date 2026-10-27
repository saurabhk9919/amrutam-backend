
const request = require("supertest");
const app = require("../src/app");

describe("Amrutam API", () => {
  describe("GET /health", () => {
    it("should return 200 and service status", async () => {
      const response = await request(app).get("/health");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: "ok",
        service: "amrutam-telemedicine-backend",
      });
    });
  });

  describe("Observability and Health Endpoints", () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalMetricsToken = process.env.METRICS_TOKEN;

    afterEach(() => {
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalNodeEnv;
      }

      if (originalMetricsToken === undefined) {
        delete process.env.METRICS_TOKEN;
      } else {
        process.env.METRICS_TOKEN = originalMetricsToken;
      }
    });

    it("allows metrics access in development", async () => {
      process.env.NODE_ENV = "development";
      delete process.env.METRICS_TOKEN;

      const response = await request(app).get("/metrics");

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toContain("text/plain");
      expect(response.text).toContain("amrutam_http_requests_total");
      expect(response.text).toContain("amrutam_http_request_duration_seconds");
    });

    it("rejects metrics requests without a token in production", async () => {
      process.env.NODE_ENV = "production";
      process.env.METRICS_TOKEN = "test-metrics-secret";

      const response = await request(app).get("/metrics");

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: "Unauthorized" });
    });

    it("rejects metrics requests with an invalid token in production", async () => {
      process.env.NODE_ENV = "production";
      process.env.METRICS_TOKEN = "test-metrics-secret";

      const response = await request(app)
        .get("/metrics")
        .set("Authorization", "Bearer wrong-token");

      expect(response.status).toBe(401);
    });

    it("allows metrics requests with the correct token in production", async () => {
      process.env.NODE_ENV = "production";
      process.env.METRICS_TOKEN = "test-metrics-secret";

      const response = await request(app)
        .get("/metrics")
        .set("Authorization", "Bearer test-metrics-secret");

      expect(response.status).toBe(200);
      expect(response.text).toContain("amrutam_http_requests_total");
    });

    it("returns 503 when the database is unavailable", async () => {
      const prisma = require("../src/config/database");
      jest
        .spyOn(prisma, "$queryRaw")
        .mockRejectedValueOnce(new Error("Connection failed"));

      const response = await request(app).get("/ready");

      expect(response.status).toBe(503);
      expect(response.body).toEqual({
        status: "not_ready",
        database: "unavailable",
      });
    });

    it("returns 200 when the database is reachable", async () => {
      const prisma = require("../src/config/database");
      jest
        .spyOn(prisma, "$queryRaw")
        .mockResolvedValueOnce([{ "?column?": 1 }]);

      const response = await request(app).get("/ready");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: "ready",
        database: "connected",
      });
    });
  });

  describe("Protected endpoints", () => {
    it("should reject unauthenticated consultation requests", async () => {
      const response = await request(app).get(
        "/api/v1/consultations"
      );

      expect(response.status).toBe(401);
    });
  });
});
