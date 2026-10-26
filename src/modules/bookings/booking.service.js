const crypto = require("crypto");
const prisma = require("../../config/database");

async function createBooking(
  patientUserId,
  { slotId, idempotencyKey }
) {
  const requestHash = crypto
    .createHash("sha256")
    .update(JSON.stringify({ slotId }))
    .digest("hex");

  const existingRequest = await prisma.idempotencyKey.findUnique({
    where: {
      userId_key: {
        userId: patientUserId,
        key: idempotencyKey,
      },
    },
  });

  if (existingRequest) {
    if (existingRequest.requestHash !== requestHash) {
      const error = new Error(
        "Idempotency key was already used for another request"
      );
      error.statusCode = 409;
      throw error;
    }

    if (
      existingRequest.responseStatus !== null &&
      existingRequest.responseBody !== null
    ) {
      return {
        statusCode: existingRequest.responseStatus,
        body: existingRequest.responseBody,
      };
    }

    const error = new Error("Booking request is being processed");
    error.statusCode = 409;
    throw error;
  }

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.idempotencyKey.create({
        data: {
          userId: patientUserId,
          key: idempotencyKey,
          requestHash,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      const slot = await tx.availabilitySlot.findUnique({
        where: { id: slotId },
        include: { doctor: true },
      });

      if (!slot || slot.status !== "OPEN") {
        const error = new Error("Availability slot is not available");
        error.statusCode = 409;
        throw error;
      }

      if (!slot.doctor.isVerified) {
        const error = new Error("Doctor is not verified");
        error.statusCode = 403;
        throw error;
      }

      if (slot.startTime <= new Date()) {
        const error = new Error("Cannot book a slot in the past");
        error.statusCode = 400;
        throw error;
      }

      const claimed = await tx.availabilitySlot.updateMany({
        where: {
          id: slotId,
          status: "OPEN",
        },
        data: {
          status: "BOOKED",
        },
      });

      if (claimed.count !== 1) {
        const error = new Error("Slot has already been booked");
        error.statusCode = 409;
        throw error;
      }

      const consultation = await tx.consultation.create({
        data: {
          patientId: patientUserId,
          slotId: slot.id,
          status: "BOOKED",
        },
      });

      const body = {
        message: "Consultation booked successfully",
        consultation,
      };

      await tx.idempotencyKey.update({
        where: {
          userId_key: {
            userId: patientUserId,
            key: idempotencyKey,
          },
        },
        data: {
          responseStatus: 201,
          responseBody: body,
        },
      });

      return {
        statusCode: 201,
        body,
      };
    });
  } catch (error) {
    if (error.code === "P2002") {
      const existing = await prisma.idempotencyKey.findUnique({
        where: {
          userId_key: {
            userId: patientUserId,
            key: idempotencyKey,
          },
        },
      });

      if (existing) {
        if (existing.requestHash !== requestHash) {
          const conflict = new Error(
            "Idempotency key was already used for another request"
          );
          conflict.statusCode = 409;
          throw conflict;
        }

        if (
          existing.responseStatus !== null &&
          existing.responseBody !== null
        ) {
          return {
            statusCode: existing.responseStatus,
            body: existing.responseBody,
          };
        }
      }

      const conflict = new Error(
        "Booking conflicts with another request"
      );
      conflict.statusCode = 409;
      throw conflict;
    }

    throw error;
  }
}

module.exports = {
  createBooking,
};
