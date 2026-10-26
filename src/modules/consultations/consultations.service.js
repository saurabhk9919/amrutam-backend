const prisma = require("../../config/database");
const { createAuditLog } = require("../audit/audit.service");

async function listConsultations(user) {
  let where = {};

  if (user.role === "PATIENT") {
    where.patientId = user.id;
  } else if (user.role === "DOCTOR") {
    where.slot = {
      doctor: {
        userId: user.id,
      },
    };
  } else if (user.role !== "ADMIN") {
    const error = new Error("Forbidden");
    error.statusCode = 403;
    throw error;
  }

  return prisma.consultation.findMany({
    where,
    include: {
      slot: {
        select: {
          id: true,
          startTime: true,
          endTime: true,
          doctor: {
            select: {
              specialization: true,
              user: {
                select: {
                  profile: {
                    select: {
                      fullName: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      patient: {
        select: {
          id: true,
          profile: {
            select: {
              fullName: true,
            },
          },
        },
      },
      prescription: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

async function getConsultationById(consultationId, user) {
  const consultation = await prisma.consultation.findUnique({
    where: { id: consultationId },
    include: {
      slot: {
        include: {
          doctor: {
            select: {
              userId: true,
              specialization: true,
              user: {
                select: {
                  profile: {
                    select: {
                      fullName: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      patient: {
        select: {
          id: true,
          profile: {
            select: {
              fullName: true,
            },
          },
        },
      },
      prescription: true,
    },
  });

  if (!consultation) {
    const error = new Error("Consultation not found");
    error.statusCode = 404;
    throw error;
  }

  const isPatient = consultation.patientId === user.id;
  const isDoctor = consultation.slot.doctor.userId === user.id;
  const isAdmin = user.role === "ADMIN";

  if (!isPatient && !isDoctor && !isAdmin) {
    const error = new Error("Forbidden");
    error.statusCode = 403;
    throw error;
  }


  delete consultation.slot.doctor.userId;

  return consultation;
}

async function updateConsultationStatus(consultationId, user, newStatus) {
  const allowedTransitions = {
    BOOKED: ["CONFIRMED", "CANCELLED"],
    CONFIRMED: ["IN_PROGRESS", "CANCELLED"],
    IN_PROGRESS: ["COMPLETED"],
    COMPLETED: [],
    CANCELLED: [],
  };

  return prisma.$transaction(async (tx) => {
    const consultation = await tx.consultation.findUnique({
      where: { id: consultationId },
      include: {
        slot: {
          include: {
            doctor: {
              select: {
                userId: true,
              },
            },
          },
        },
      },
    });

    if (!consultation) {
      const error = new Error("Consultation not found");
      error.statusCode = 404;
      throw error;
    }

    const isDoctor = consultation.slot.doctor.userId === user.id;
    const isAdmin = user.role === "ADMIN";

    if (!isDoctor && !isAdmin) {
      const error = new Error("Only the assigned doctor or an admin can update consultation status");
      error.statusCode = 403;
      throw error;
    }

    if (!allowedTransitions[consultation.status]?.includes(newStatus)) {
      const error = new Error(
        `Cannot change consultation status from ${consultation.status} to ${newStatus}`
      );
      error.statusCode = 409;
      throw error;
    }

    const updated = await tx.consultation.updateMany({
      where: {
        id: consultationId,
        status: consultation.status,
      },
      data: { status: newStatus },
    });

    if (updated.count !== 1) {
      const error = new Error("Consultation status changed concurrently; refresh and retry");
      error.statusCode = 409;
      throw error;
    }

    await createAuditLog({
      actorId: user.id,
      action:
        newStatus === "CANCELLED"
          ? "CONSULTATION_CANCELLED"
          : "CONSULTATION_STATUS_UPDATED",
      entityType: "Consultation",
      entityId: consultationId,
      requestId: user.requestId || null,
      metadata: {
        previousStatus: consultation.status,
        newStatus,
      },
      db: tx,
    });

    return tx.consultation.findUnique({
      where: { id: consultationId },
      include: {
        slot: {
          select: {
            startTime: true,
            endTime: true,
          },
        },
      },
    });
  });
}

module.exports = {
  listConsultations,
  getConsultationById,
  updateConsultationStatus,
};
