
const prisma = require("../../config/database");

async function createAvailability(userId, { startTime, endTime }) {
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (end <= start) {
    const error = new Error("End time must be after start time");
    error.statusCode = 400;
    throw error;
  }

  const doctor = await prisma.doctor.findUnique({
    where: { userId },
  });

  if (!doctor) {
    const error = new Error("Doctor profile not found");
    error.statusCode = 404;
    throw error;
  }

  return prisma.availabilitySlot.create({
    data: {
      doctorId: doctor.id,
      startTime: start,
      endTime: end,
    },
  });
}

async function listAvailableSlots({ doctorId, from, to }) {
  return prisma.availabilitySlot.findMany({
    where: {
      status: "OPEN",
      ...(doctorId ? { doctorId } : {}),
      ...(from || to
        ? {
            startTime: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lt: new Date(to) } : {}),
            },
          }
        : {}),
    },
    orderBy: {
      startTime: "asc",
    },
  });
}

module.exports = {
  createAvailability,
  listAvailableSlots,
};
