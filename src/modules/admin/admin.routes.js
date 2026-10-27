
const express = require("express");
const { z } = require("zod");

const {
  authenticateToken,
  authorizeRoles,
} = require("../../middleware/auth.middleware");

const {
  verifyDoctor,
  getConsultationAnalytics,
} = require("./admin.service");

const router = express.Router();

const doctorIdSchema = z.string().uuid();

const analyticsQuerySchema = z
  .object({
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
  })
  .refine(
    (query) =>
      !query.from ||
      !query.to ||
      new Date(query.from) < new Date(query.to),
    {
      message: "'from' must be earlier than 'to'",
      path: ["to"],
    }
  );

router.patch(
  "/doctors/:doctorId/verify",
  authenticateToken,
  authorizeRoles("ADMIN"),
  async (req, res, next) => {
    try {
      const parsedId = doctorIdSchema.safeParse(req.params.doctorId);

      if (!parsedId.success) {
        return res.status(400).json({
          error: "Invalid doctor ID",
        });
      }

      const doctor = await verifyDoctor({
        doctorId: parsedId.data,
        actorId: req.user.id,
        requestId: req.requestId,
      });

      return res.status(200).json({
        message: "Doctor verified successfully",
        doctor,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/analytics/consultations",
  authenticateToken,
  authorizeRoles("ADMIN"),
  async (req, res, next) => {
    try {
      const parsedQuery = analyticsQuerySchema.safeParse(req.query);

      if (!parsedQuery.success) {
        return res.status(400).json({
          error: "Invalid analytics query",
          details: parsedQuery.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      const { from, to } = parsedQuery.data;

      const analytics = await getConsultationAnalytics({
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
      });

      return res.status(200).json(analytics);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
