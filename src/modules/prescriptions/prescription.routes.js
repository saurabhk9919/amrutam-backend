const express = require("express");
const { authenticateToken } = require("../../middleware/auth.middleware");
const { prescriptionSchema } = require("./prescription.validation");
const {
  createPrescription,
  getPrescription,
} = require("./prescription.service");

const router = express.Router();

router.use(authenticateToken);

router.post("/:id/prescription", async (req, res, next) => {
  try {
    const validation = prescriptionSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: "Invalid prescription data",
        details: validation.error.issues,
      });
    }

    const prescription = await createPrescription(
      req.params.id,
      { ...req.user, requestId: req.requestId },
      validation.data
    );

    res.status(201).json({
      message: "Prescription created successfully",
      data: prescription,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/prescription", async (req, res, next) => {
  try {
    const prescription = await getPrescription(
      req.params.id,
      req.user
    );

    res.status(200).json({ data: prescription });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
