
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

  describe("Protected endpoints", () => {
    it("should reject unauthenticated consultation requests", async () => {
      const response = await request(app).get(
        "/api/v1/consultations"
      );

      expect(response.status).toBe(401);
    });
  });
});
