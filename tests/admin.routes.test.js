jest.mock("../src/modules/admin/admin.service", () => ({
  verifyDoctor: jest.fn(),
  getConsultationAnalytics: jest.fn(),
}));

jest.mock("../src/config/database", () => ({
  user: {
    findUnique: jest.fn(),
  },
}));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const prisma = require("../src/config/database");

const {
  verifyDoctor,
  getConsultationAnalytics,
} = require("../src/modules/admin/admin.service");
const {
  requestIdMiddleware,
} = require("../src/middleware/request-id.middleware");
const adminRoutes = require("../src/modules/admin/admin.routes");

const JWT_SECRET = "test-jwt-secret";
process.env.JWT_SECRET = JWT_SECRET;

function createToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });
}

const app = express();
app.use(express.json());
app.use(requestIdMiddleware);
app.use("/api/v1/admin", adminRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: err.statusCode ? err.message : "Internal server error",
  });
});

describe("Admin Routes", () => {
  const adminToken = createToken({ sub: "admin-123", role: "ADMIN" });
  const patientToken = createToken({ sub: "patient-123", role: "PATIENT" });
  const doctorToken = createToken({ sub: "doctor-123", role: "DOCTOR" });
  const validDoctorId = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({ isActive: true });
  });

  describe("PATCH /api/v1/admin/doctors/:doctorId/verify", () => {
    it("rejects unauthenticated requests with 401", async () => {
      const response = await request(app).patch(
        `/api/v1/admin/doctors/${validDoctorId}/verify`
      );

      expect(response.status).toBe(401);
      expect(verifyDoctor).not.toHaveBeenCalled();
    });

    it("rejects non-admin roles with 403", async () => {
      const patientResponse = await request(app)
        .patch(`/api/v1/admin/doctors/${validDoctorId}/verify`)
        .set("Authorization", `Bearer ${patientToken}`);

      expect(patientResponse.status).toBe(403);

      const doctorResponse = await request(app)
        .patch(`/api/v1/admin/doctors/${validDoctorId}/verify`)
        .set("Authorization", `Bearer ${doctorToken}`);

      expect(doctorResponse.status).toBe(403);
      expect(verifyDoctor).not.toHaveBeenCalled();
    });

    it("rejects an invalid doctor UUID with 400", async () => {
      const response = await request(app)
        .patch("/api/v1/admin/doctors/invalid-uuid/verify")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: "Invalid doctor ID",
      });
      expect(verifyDoctor).not.toHaveBeenCalled();
    });

    it("verifies a doctor successfully for an admin", async () => {
      const doctorData = {
        id: validDoctorId,
        isVerified: true,
        specialization: "Dermatology",
      };
      verifyDoctor.mockResolvedValue(doctorData);

      const response = await request(app)
        .patch(`/api/v1/admin/doctors/${validDoctorId}/verify`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: "Doctor verified successfully",
        doctor: doctorData,
      });
      expect(verifyDoctor).toHaveBeenCalledWith(
        expect.objectContaining({
          doctorId: validDoctorId,
          actorId: "admin-123",
          requestId: expect.any(String),
        })
      );
    });

    it("forwards service errors like 404 to error handler", async () => {
      const error = new Error("Doctor not found");
      error.statusCode = 404;
      verifyDoctor.mockRejectedValue(error);

      const response = await request(app)
        .patch(`/api/v1/admin/doctors/${validDoctorId}/verify`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: "Doctor not found",
      });
    });
  });

  describe("GET /api/v1/admin/analytics/consultations", () => {
    it("rejects unauthenticated requests with 401", async () => {
      const response = await request(app).get(
        "/api/v1/admin/analytics/consultations"
      );

      expect(response.status).toBe(401);
      expect(getConsultationAnalytics).not.toHaveBeenCalled();
    });

    it("rejects non-admin roles with 403", async () => {
      const response = await request(app)
        .get("/api/v1/admin/analytics/consultations")
        .set("Authorization", `Bearer ${patientToken}`);

      expect(response.status).toBe(403);
      expect(getConsultationAnalytics).not.toHaveBeenCalled();
    });

    it("returns analytics successfully without query parameters", async () => {
      const analyticsData = {
        total: 15,
        byStatus: {
          BOOKED: 5,
          CONFIRMED: 3,
          IN_PROGRESS: 2,
          COMPLETED: 4,
          CANCELLED: 1,
        },
        period: { from: null, to: null },
      };
      getConsultationAnalytics.mockResolvedValue(analyticsData);

      const response = await request(app)
        .get("/api/v1/admin/analytics/consultations")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(analyticsData);
      expect(getConsultationAnalytics).toHaveBeenCalledWith({
        from: undefined,
        to: undefined,
      });
    });

    it("returns analytics filtered by valid date range", async () => {
      const from = "2026-10-01T00:00:00.000Z";
      const to = "2026-10-20T00:00:00.000Z";

      getConsultationAnalytics.mockResolvedValue({
        total: 5,
        byStatus: {
          BOOKED: 1,
          CONFIRMED: 1,
          IN_PROGRESS: 1,
          COMPLETED: 1,
          CANCELLED: 1,
        },
        period: { from, to },
      });

      const response = await request(app)
        .get(`/api/v1/admin/analytics/consultations?from=${from}&to=${to}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(getConsultationAnalytics).toHaveBeenCalledWith({
        from: new Date(from),
        to: new Date(to),
      });
    });

    it("rejects requests when 'from' is later than 'to' with 400", async () => {
      const from = "2026-10-25T00:00:00.000Z";
      const to = "2026-10-10T00:00:00.000Z";

      const response = await request(app)
        .get(`/api/v1/admin/analytics/consultations?from=${from}&to=${to}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Invalid analytics query");
      expect(getConsultationAnalytics).not.toHaveBeenCalled();
    });

    it("rejects invalid date formats with 400", async () => {
      const response = await request(app)
        .get("/api/v1/admin/analytics/consultations?from=not-a-date")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Invalid analytics query");
      expect(getConsultationAnalytics).not.toHaveBeenCalled();
    });

    it("forwards service errors to error handler", async () => {
      getConsultationAnalytics.mockRejectedValue(new Error("Database error"));

      const response = await request(app)
        .get("/api/v1/admin/analytics/consultations")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe("Internal server error");
    });
  });
});
