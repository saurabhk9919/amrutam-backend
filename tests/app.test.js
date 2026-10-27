
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
    it("GET /metrics should return 200 and prometheus metrics", async () => {
      const response = await request(app).get("/metrics");

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toContain("text/plain");
      expect(response.text).toContain("amrutam_http_requests_total");
      expect(response.text).toContain("amrutam_http_request_duration_seconds");
    });

    it("GET /ready should return 200 when database is reachable", async () => {
      const prisma = require("../src/config/database");
      jest.spyOn(prisma, "$queryRaw").mockResolvedValueOnce([{ "?column?": 1 }]);

      const response = await request(app).get("/ready");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: "ready",
        database: "connected",
      });
    });

    it("GET /ready should return 503 when database query fails", async () => {
      const prisma = require("../src/config/database");
      jest.spyOn(prisma, "$queryRaw").mockRejectedValueOnce(new Error("Connection failed"));

      const response = await request(app).get("/ready");

      expect(response.status).toBe(503);
      expect(response.body).toEqual({
        status: "not_ready",
        database: "unavailable",
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
