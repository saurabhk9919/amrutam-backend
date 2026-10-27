
jest.mock("../src/config/database", () => ({
  consultation: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(),
}));

jest.mock("../src/modules/audit/audit.service", () => ({
  createAuditLog: jest.fn(),
}));

const prisma = require("../src/config/database");
const { createAuditLog } = require("../src/modules/audit/audit.service");

const {
  listConsultations,
  getConsultationById,
  updateConsultationStatus,
} = require("../src/modules/consultations/consultations.service");

describe("Consultation service", () => {
  const consultationId = "23b7112a-71df-4d82-b3ea-60b292692e55";

  const patient = {
    id: "patient-123",
    role: "PATIENT",
  };

  const doctor = {
    id: "doctor-123",
    role: "DOCTOR",
    requestId: "request-123",
  };

  let tx;
  let consultation;

  beforeEach(() => {
    jest.clearAllMocks();

    consultation = {
      id: consultationId,
      patientId: patient.id,
      status: "BOOKED",
      slot: {
        doctor: {
          userId: doctor.id,
        },
      },
    };

    tx = {
      consultation: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    prisma.$transaction.mockImplementation(async (callback) =>
      callback(tx)
    );

    createAuditLog.mockResolvedValue({ id: "audit-123" });
  });

  describe("listConsultations", () => {
    it("filters patient consultations by patient ID", async () => {
      prisma.consultation.findMany.mockResolvedValue([]);

      await listConsultations(patient);

      expect(prisma.consultation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { patientId: patient.id },
        })
      );
    });

    it("rejects an unsupported user role", async () => {
      await expect(
        listConsultations({ id: "user-123", role: "UNKNOWN" })
      ).rejects.toMatchObject({
        statusCode: 403,
        message: "Forbidden",
      });
    });
  });

  describe("getConsultationById", () => {
    it("returns the consultation to its patient", async () => {
      const record = {
        ...consultation,
        slot: {
          doctor: {
            userId: doctor.id,
            specialization: "General Medicine",
          },
        },
      };

      prisma.consultation.findUnique.mockResolvedValue(record);

      const result = await getConsultationById(consultationId, patient);

      expect(result.id).toBe(consultationId);
      expect(result.slot.doctor.userId).toBeUndefined();
    });

    it("rejects access by an unrelated patient", async () => {
      prisma.consultation.findUnique.mockResolvedValue(consultation);

      await expect(
        getConsultationById(consultationId, {
          id: "unrelated-patient",
          role: "PATIENT",
        })
      ).rejects.toMatchObject({
        statusCode: 403,
        message: "Forbidden",
      });
    });

    it("returns 404 when the consultation does not exist", async () => {
      prisma.consultation.findUnique.mockResolvedValue(null);

      await expect(
        getConsultationById(consultationId, patient)
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "Consultation not found",
      });
    });
  });

  describe("updateConsultationStatus", () => {
    it("updates status and writes an audit record", async () => {
      const updatedConsultation = {
        id: consultationId,
        status: "CONFIRMED",
      };

      tx.consultation.findUnique.mockResolvedValue(consultation);
      tx.consultation.updateMany.mockResolvedValue({ count: 1 });
      tx.consultation.findUnique.mockResolvedValueOnce(consultation)
        .mockResolvedValueOnce(updatedConsultation);

      const result = await updateConsultationStatus(
        consultationId,
        doctor,
        "CONFIRMED"
      );

      expect(result.status).toBe("CONFIRMED");

      expect(tx.consultation.updateMany).toHaveBeenCalledWith({
        where: {
          id: consultationId,
          status: "BOOKED",
        },
        data: { status: "CONFIRMED" },
      });

      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: doctor.id,
          action: "CONSULTATION_STATUS_UPDATED",
          entityType: "Consultation",
          entityId: consultationId,
          requestId: doctor.requestId,
          metadata: {
            previousStatus: "BOOKED",
            newStatus: "CONFIRMED",
          },
          db: tx,
        })
      );
    });

    it("rejects a patient attempting to update status", async () => {
      tx.consultation.findUnique.mockResolvedValue(consultation);

      await expect(
        updateConsultationStatus(consultationId, patient, "CONFIRMED")
      ).rejects.toMatchObject({
        statusCode: 403,
      });

      expect(tx.consultation.updateMany).not.toHaveBeenCalled();
      expect(createAuditLog).not.toHaveBeenCalled();
    });

    it("rejects a patient whose ID matches the assigned doctor", async () => {
      const patientMatchingDoctorId = {
        id: doctor.id,
        role: "PATIENT",
        requestId: "patient-request",
      };

      tx.consultation.findUnique.mockResolvedValue(consultation);

      await expect(
        updateConsultationStatus(
          consultationId,
          patientMatchingDoctorId,
          "CONFIRMED"
        )
      ).rejects.toMatchObject({
        statusCode: 403,
        message:
          "Only the assigned doctor or an admin can update consultation status",
      });

      expect(tx.consultation.updateMany).not.toHaveBeenCalled();
      expect(createAuditLog).not.toHaveBeenCalled();
    });

    it("rejects an invalid status transition", async () => {
      tx.consultation.findUnique.mockResolvedValue(consultation);

      await expect(
        updateConsultationStatus(consultationId, doctor, "COMPLETED")
      ).rejects.toMatchObject({
        statusCode: 409,
        message: "Cannot change consultation status from BOOKED to COMPLETED",
      });

      expect(tx.consultation.updateMany).not.toHaveBeenCalled();
      expect(createAuditLog).not.toHaveBeenCalled();
    });

    it("rejects a concurrent status change", async () => {
      tx.consultation.findUnique.mockResolvedValue(consultation);
      tx.consultation.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        updateConsultationStatus(consultationId, doctor, "CONFIRMED")
      ).rejects.toMatchObject({
        statusCode: 409,
        message: "Consultation status changed concurrently; refresh and retry",
      });

      expect(createAuditLog).not.toHaveBeenCalled();
    });
  });
});
