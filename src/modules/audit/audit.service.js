const prisma = require("../../config/database");

const ALLOWED_ACTIONS = new Set([
  "CONSULTATION_STATUS_UPDATED",
  "PRESCRIPTION_CREATED",
  "DOCTOR_VERIFIED",
  "CONSULTATION_CANCELLED",
]);

async function createAuditLog({
  actorId = null,
  action,
  entityType,
  entityId = null,
  requestId = null,
  metadata = undefined,
  db = prisma,
}) {
  if (!ALLOWED_ACTIONS.has(action)) {
    throw new Error("Unsupported audit action");
  }

  return db.auditLog.create({
    data: {
      actorId,
      action,
      entityType,
      entityId: entityId ? String(entityId) : null,
      requestId,
      ...(metadata !== undefined ? { metadata } : {}),
    },
  });
}

async function listAuditLogs({
  actorId,
  entityType,
  entityId,
  limit = 50,
}) {
  const take = Math.min(Math.max(Number(limit) || 50, 1), 100);

  return prisma.auditLog.findMany({
    where: {
      ...(actorId ? { actorId } : {}),
      ...(entityType ? { entityType } : {}),
      ...(entityId ? { entityId: String(entityId) } : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
  });
}

module.exports = {
  createAuditLog,
  listAuditLogs,
};
