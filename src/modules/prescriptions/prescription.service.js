const prisma = require("../../config/database");
const { createAuditLog } = require("../audit/audit.service");

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function createPrescription(consultationId, user, data) {
  try {
    return await prisma.$transaction(async (tx) => {
      const consultation = await tx.consultation.findUnique({
        where: { id: consultationId },
        include: {
          slot: {
            include: {
              doctor: {
                select: { userId: true },
              },
            },
          },
        },
      });

      if (!consultation) {
        throw createError("Consultation not found", 404);
      }

      if (consultation.slot.doctor.userId !== user.id) {
        throw createError(
          "Only the assigned doctor can create this prescription",
          403
        );
      }

      if (consultation.status !== "COMPLETED") {
        throw createError(
          "Prescription can only be created for a completed consultation",
          409
        );
      }

      const existing = await tx.prescription.findUnique({
        where: { consultationId },
      });

      if (existing) {
        throw createError(
          "A prescription already exists for this consultation",
          409
        );
      }

      const prescription = await tx.prescription.create({
        data: {
          consultationId,
          doctorUserId: user.id,
          details: data.details,
          instructions: data.instructions,
        },
      });

      await createAuditLog({
        actorId: user.id,
        action: "PRESCRIPTION_CREATED",
        entityType: "Prescription",
        entityId: prescription.id,
        requestId: user.requestId || null,
        metadata: {
          consultationId,
        },
        db: tx,
      });

      return prescription;
    });
  } catch (error) {
    if (error.code === "P2002") {
      throw createError(
        "A prescription already exists for this consultation",
        409
      );
    }
    throw error;
  }
}

async function getPrescription(consultationId, user) {
  const consultation = await prisma.consultation.findUnique({
    where: { id: consultationId },
    include: {
      slot: {
        include: {
          doctor: {
            select: { userId: true },
          },
        },
      },
      prescription: true,
    },
  });

  if (!consultation) {
    throw createError("Consultation not found", 404);
  }

  const isPatient = consultation.patientId === user.id;
  const isDoctor = consultation.slot.doctor.userId === user.id;
  const isAdmin = user.role === "ADMIN";

  if (!isPatient && !isDoctor && !isAdmin) {
    throw createError("Forbidden", 403);
  }

  if (!consultation.prescription) {
    throw createError("Prescription not found", 404);
  }

  return consultation.prescription;
}

module.exports = {
  createPrescription,
  getPrescription,
};
