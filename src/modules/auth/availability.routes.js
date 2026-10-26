
const express = require("express");

const {
  authenticateToken,
  authorizeRoles,
} = require("../../middleware/auth.middleware");

const {
  createAvailabilitySchema,
} = require("./availability.validation");

const {
  createAvailability,
  listAvailableSlots,
} = require("./availability.service");

const router = express.Router();

router.post(
  "/",
  authenticateToken,
  authorizeRoles("DOCTOR"),
  async (req, res, next) => {
    try {
      const result = createAvailabilitySchema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: result.error.issues,
        });
      }

      const slot = await createAvailability(req.user.id, result.data);

      return res.status(201).json({
        message: "Availability created successfully",
        slot,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get("/", async (req, res, next) => {
  try {
    const slots = await listAvailableSlots({
      doctorId: req.query.doctorId,
      from: req.query.from,
      to: req.query.to,
    });

    return res.status(200).json({
      count: slots.length,
      slots,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
