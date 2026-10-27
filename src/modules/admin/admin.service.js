
const prisma = require("../../config/database");
const { createAuditLog } = require("../audit/audit.service");

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function verifyDoctor({ doctorId, actorId, requestId }) {
  return prisma.$transaction(async (tx) => {
    const doctor = await tx.doctor.findUnique({
      where: { id: doctorId },
    });

    if (!doctor) {
      throw createError("Doctor not found", 404);
    }

    // Make verification idempotent: don't create duplicate audit events.
    if (doctor.isVerified) {
      return doctor;
    }

    const verifiedDoctor = await tx.doctor.update({
      where: { id: doctorId },
      data: { isVerified: true },
    });

    await createAuditLog({
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

    return verifiedDoctor;
  });
}

async function getConsultationAnalytics({ from, to } = {}) {
  const createdAt = {};

  if (from) createdAt.gte = from;
  if (to) createdAt.lt = to;

  const where =
    Object.keys(createdAt).length > 0 ? { createdAt } : {};

  const [total, groupedStatuses] = await prisma.$transaction([
    prisma.consultation.count({ where }),
    prisma.consultation.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
    }),
  ]);

  const byStatus = {
    BOOKED: 0,
    CONFIRMED: 0,
    IN_PROGRESS: 0,
    COMPLETED: 0,
    CANCELLED: 0,
  };

  for (const group of groupedStatuses) {
    byStatus[group.status] = group._count._all;
  }

  return {
    total,
    byStatus,
    period: {
      from: from ? from.toISOString() : null,
      to: to ? to.toISOString() : null,
    },
  };
}

module.exports = {
  verifyDoctor,
  getConsultationAnalytics,
};
