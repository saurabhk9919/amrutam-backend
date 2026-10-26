const express = require("express");

const {
  authenticateToken,
  authorizeRoles,
} = require("../../middleware/auth.middleware");

const {
  createBookingSchema,
} = require("./booking.validation");

const {
  createBooking,
} = require("./booking.service");

const router = express.Router();

router.post(
  "/",
  authenticateToken,
  authorizeRoles("PATIENT"),
  async (req, res, next) => {
    try {
      const result = createBookingSchema.safeParse({
        ...req.body,
        idempotencyKey: req.headers["idempotency-key"],
      });

      if (!result.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: result.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      const resultData = await createBooking(
        req.user.id,
        result.data
      );

      return res.status(resultData.statusCode).json(resultData.body);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
