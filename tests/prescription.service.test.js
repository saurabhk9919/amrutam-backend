
jest.mock("../src/config/database", () => ({
  consultation: {
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
  createPrescription,
  getPrescription,
} = require("../src/modules/prescriptions/prescription.service");

describe("Prescription service", () => {
  const consultationId = "23b7112a-71df-4d82-b3ea-60b292692e55";
  const prescriptionId = "0b357778-7581-4e4c-b1ae-9f1e2863dffa";

  const doctor = {
    id: "doctor-123",
    role: "DOCTOR",
    requestId: "request-123",
  };

  const patient = {
    id: "patient-123",
    role: "PATIENT",
  };

  const prescriptionData = {
    details: [
      {
        medicine: "Example Medicine",
        dosage: "As prescribed",
        frequency: "Twice daily",
        duration: "5 days",
      },
    ],
    instructions: "Follow the prescribed schedule",
  };

  let tx;
  let consultation;

  beforeEach(() => {
    jest.clearAllMocks();

    consultation = {
      id: consultationId,
      patientId: patient.id,
      status: "COMPLETED",
      slot: {
        doctor: {
          userId: doctor.id,
        },
      },
      prescription: null,
    };

    tx = {
      consultation: {
        findUnique: jest.fn(),
      },
      prescription: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };

    prisma.$transaction.mockImplementation(async (callback) =>
      callback(tx)
    );

    createAuditLog.mockResolvedValue({ id: "audit-123" });
  });

  describe("createPrescription", () => {
    it("creates a prescription and writes an audit record", async () => {
      const createdPrescription = {
        id: prescriptionId,
        consultationId,
        doctorUserId: doctor.id,
        details: prescriptionData.details,
        instructions: prescriptionData.instructions,
      };

      tx.consultation.findUnique.mockResolvedValue(consultation);
      tx.prescription.findUnique.mockResolvedValue(null);
      tx.prescription.create.mockResolvedValue(createdPrescription);

      const result = await createPrescription(
        consultationId,
        doctor,
        prescriptionData
      );

      expect(result).toEqual(createdPrescription);

      expect(tx.prescription.create).toHaveBeenCalledWith({
        data: {
          consultationId,
          doctorUserId: doctor.id,
          details: prescriptionData.details,
          instructions: prescriptionData.instructions,
        },
      });

      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: doctor.id,
          action: "PRESCRIPTION_CREATED",
          entityType: "Prescription",
          entityId: prescriptionId,
          requestId: doctor.requestId,
          metadata: { consultationId },
          db: tx,
        })
      );
    });

    it("returns 404 when the consultation does not exist", async () => {
      tx.consultation.findUnique.mockResolvedValue(null);

      await expect(
        createPrescription(consultationId, doctor, prescriptionData)
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "Consultation not found",
      });

      expect(tx.prescription.create).not.toHaveBeenCalled();
    });

    it("rejects a doctor who is not assigned to the consultation", async () => {
      consultation.slot.doctor.userId = "another-doctor";
      tx.consultation.findUnique.mockResolvedValue(consultation);

      await expect(
        createPrescription(consultationId, doctor, prescriptionData)
      ).rejects.toMatchObject({
        statusCode: 403,
        message: "Only the assigned doctor can create this prescription",
      });

      expect(tx.prescription.create).not.toHaveBeenCalled();
      expect(createAuditLog).not.toHaveBeenCalled();
    });

    it("rejects prescriptions for incomplete consultations", async () => {
      consultation.status = "IN_PROGRESS";
      tx.consultation.findUnique.mockResolvedValue(consultation);

      await expect(
        createPrescription(consultationId, doctor, prescriptionData)
      ).rejects.toMatchObject({
        statusCode: 409,
        message: "Prescription can only be created for a completed consultation",
      });

      expect(tx.prescription.create).not.toHaveBeenCalled();
    });

    it("rejects duplicate prescriptions", async () => {
      tx.consultation.findUnique.mockResolvedValue(consultation);
      tx.prescription.findUnique.mockResolvedValue({
        id: prescriptionId,
      });

      await expect(
        createPrescription(consultationId, doctor, prescriptionData)
      ).rejects.toMatchObject({
        statusCode: 409,
        message: "A prescription already exists for this consultation",
      });

      expect(tx.prescription.create).not.toHaveBeenCalled();
    });

    it("converts a database unique-constraint error to 409", async () => {
      tx.consultation.findUnique.mockResolvedValue(consultation);
      tx.prescription.findUnique.mockResolvedValue(null);

      const uniqueError = new Error("Unique constraint violation");
      uniqueError.code = "P2002";
      tx.prescription.create.mockRejectedValue(uniqueError);

      await expect(
        createPrescription(consultationId, doctor, prescriptionData)
      ).rejects.toMatchObject({
        statusCode: 409,
        message: "A prescription already exists for this consultation",
      });

      expect(createAuditLog).not.toHaveBeenCalled();
    });
  });

  describe("getPrescription", () => {
    it("allows the patient who owns the consultation", async () => {
      const record = {
        ...consultation,
        prescription: {
          id: prescriptionId,
          consultationId,
        },
      };

      prisma.consultation.findUnique.mockResolvedValue(record);

      const result = await getPrescription(consultationId, patient);

      expect(result.id).toBe(prescriptionId);
    });

    it("rejects an unrelated patient", async () => {
      prisma.consultation.findUnique.mockResolvedValue(consultation);

      await expect(
        getPrescription(consultationId, {
          id: "unrelated-patient",
          role: "PATIENT",
        })
      ).rejects.toMatchObject({
        statusCode: 403,
        message: "Forbidden",
      });
    });

    it("returns 404 when the prescription does not exist", async () => {
      prisma.consultation.findUnique.mockResolvedValue(consultation);

      await expect(
        getPrescription(consultationId, patient)
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "Prescription not found",
      });
    });

    it("returns 404 when the consultation does not exist", async () => {
      prisma.consultation.findUnique.mockResolvedValue(null);

      await expect(
        getPrescription(consultationId, patient)
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "Consultation not found",
      });
    });
  });
});
