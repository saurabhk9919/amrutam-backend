jest.mock("../src/config/database", () => ({
  doctor: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  consultation: {
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  $transaction: jest.fn(),
}));

jest.mock("../src/modules/audit/audit.service", () => ({
  createAuditLog: jest.fn(),
}));

const prisma = require("../src/config/database");
const { createAuditLog } = require("../src/modules/audit/audit.service");
const {
  verifyDoctor,
  getConsultationAnalytics,
} = require("../src/modules/admin/admin.service");

describe("Admin Service", () => {
  let tx;

  beforeEach(() => {
    jest.clearAllMocks();

    tx = {
      doctor: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    prisma.$transaction.mockImplementation(async (arg) => {
      if (typeof arg === "function") {
        return arg(tx);
      }
      return Promise.all(arg);
    });
  });

  describe("verifyDoctor", () => {
    const doctorId = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
    const actorId = "admin-user-123";
    const requestId = "req-uuid-456";

    it("verifies an unverified doctor and creates an audit log", async () => {
      const existingDoctor = {
        id: doctorId,
        isVerified: false,
        specialization: "Ayurveda",
      };
      const updatedDoctor = {
        ...existingDoctor,
        isVerified: true,
      };

      tx.doctor.findUnique.mockResolvedValue(existingDoctor);
      tx.doctor.update.mockResolvedValue(updatedDoctor);
      createAuditLog.mockResolvedValue({});

      const result = await verifyDoctor({ doctorId, actorId, requestId });

      expect(tx.doctor.findUnique).toHaveBeenCalledWith({
        where: { id: doctorId },
      });
      expect(tx.doctor.update).toHaveBeenCalledWith({
        where: { id: doctorId },
        data: { isVerified: true },
      });
      expect(createAuditLog).toHaveBeenCalledWith({
        actorId,
        action: "DOCTOR_VERIFIED",
        entityType: "Doctor",
        entityId: doctorId,
        requestId,
        metadata: {
          previousIsVerified: false,
          isVerified: true,
        },
        db: tx,
      });
      expect(result).toEqual(updatedDoctor);
    });

    it("throws 404 when doctor is not found", async () => {
      tx.doctor.findUnique.mockResolvedValue(null);

      await expect(
        verifyDoctor({ doctorId, actorId, requestId })
      ).rejects.toMatchObject({
        message: "Doctor not found",
        statusCode: 404,
      });

      expect(tx.doctor.update).not.toHaveBeenCalled();
      expect(createAuditLog).not.toHaveBeenCalled();
    });

    it("is idempotent: returns existing doctor without updating or logging when already verified", async () => {
      const alreadyVerifiedDoctor = {
        id: doctorId,
        isVerified: true,
        specialization: "Ayurveda",
      };

      tx.doctor.findUnique.mockResolvedValue(alreadyVerifiedDoctor);

      const result = await verifyDoctor({ doctorId, actorId, requestId });

      expect(result).toEqual(alreadyVerifiedDoctor);
      expect(tx.doctor.update).not.toHaveBeenCalled();
      expect(createAuditLog).not.toHaveBeenCalled();
    });
  });

  describe("getConsultationAnalytics", () => {
    it("returns total and breakdown by status without date filters", async () => {
      prisma.consultation.count.mockResolvedValue(10);
      prisma.consultation.groupBy.mockResolvedValue([
        { status: "BOOKED", _count: { _all: 3 } },
        { status: "COMPLETED", _count: { _all: 5 } },
        { status: "CANCELLED", _count: { _all: 2 } },
      ]);

      const result = await getConsultationAnalytics();

      expect(prisma.consultation.count).toHaveBeenCalledWith({ where: {} });
      expect(prisma.consultation.groupBy).toHaveBeenCalledWith({
        by: ["status"],
        where: {},
        _count: { _all: true },
      });
      expect(result).toEqual({
        total: 10,
        byStatus: {
          BOOKED: 3,
          CONFIRMED: 0,
          IN_PROGRESS: 0,
          COMPLETED: 5,
          CANCELLED: 2,
        },
        period: {
          from: null,
          to: null,
        },
      });
    });

    it("filters consultations by date range when from and to are provided", async () => {
      const from = new Date("2026-10-01T00:00:00.000Z");
      const to = new Date("2026-10-15T00:00:00.000Z");

      prisma.consultation.count.mockResolvedValue(4);
      prisma.consultation.groupBy.mockResolvedValue([
        { status: "CONFIRMED", _count: { _all: 4 } },
      ]);

      const result = await getConsultationAnalytics({ from, to });

      const expectedWhere = {
        createdAt: {
          gte: from,
          lt: to,
        },
      };

      expect(prisma.consultation.count).toHaveBeenCalledWith({
        where: expectedWhere,
      });
      expect(prisma.consultation.groupBy).toHaveBeenCalledWith({
        by: ["status"],
        where: expectedWhere,
        _count: { _all: true },
      });
      expect(result).toEqual({
        total: 4,
        byStatus: {
          BOOKED: 0,
          CONFIRMED: 4,
          IN_PROGRESS: 0,
          COMPLETED: 0,
          CANCELLED: 0,
        },
        period: {
          from: from.toISOString(),
          to: to.toISOString(),
        },
      });
    });

    it("filters consultations when only from date is provided", async () => {
      const from = new Date("2026-10-01T00:00:00.000Z");

      prisma.consultation.count.mockResolvedValue(2);
      prisma.consultation.groupBy.mockResolvedValue([
        { status: "BOOKED", _count: { _all: 2 } },
      ]);

      const result = await getConsultationAnalytics({ from });

      expect(prisma.consultation.count).toHaveBeenCalledWith({
        where: { createdAt: { gte: from } },
      });
      expect(result.period).toEqual({
        from: from.toISOString(),
        to: null,
      });
    });
  });
});
