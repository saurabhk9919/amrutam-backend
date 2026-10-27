const path = require("path");
const YAML = require("yamljs");

describe("OpenAPI specification", () => {
  let document;

  beforeAll(() => {
    document = YAML.load(
      path.join(__dirname, "../openapi/openapi.yaml")
    );
  });

  test("uses a supported OpenAPI version", () => {
    expect(document.openapi).toBe("3.0.3");
  });

  test("has API metadata", () => {
    expect(document.info.title).toBe("Amrutam Telemedicine API");
    expect(document.info.version).toBeDefined();
  });

  test("documents the main API endpoints", () => {
    const expectedPaths = [
      "/health",
      "/ready",
      "/api/v1/auth/register",
      "/api/v1/auth/login",
      "/api/v1/auth/me",
      "/api/v1/availability",
      "/api/v1/bookings",
      "/api/v1/consultations",
      "/api/v1/consultations/{id}",
      "/api/v1/consultations/{id}/status",
      "/api/v1/consultations/{id}/prescription",
      "/api/v1/admin/doctors/{doctorId}/verify",
      "/api/v1/admin/analytics/consultations",
    ];

    for (const endpoint of expectedPaths) {
      expect(document.paths[endpoint]).toBeDefined();
    }
  });

  test("defines JWT bearer authentication", () => {
    expect(document.components.securitySchemes.bearerAuth).toEqual({
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
    });
  });
});
