const express = require("express");
const { z } = require("zod");
const { authenticateToken } = require("../../middleware/auth.middleware");

const {
  listConsultations,
  getConsultationById,
  updateConsultationStatus,
} = require("./consultations.service");

const router = express.Router();

const statusSchema = z.object({
  status: z.enum([
    "CONFIRMED",
    "IN_PROGRESS",
    "COMPLETED",
    "CANCELLED",
  ]),
});

router.use(authenticateToken);

router.get("/", async (req, res, next) => {
  try {
    const consultations = await listConsultations(req.user);
    res.status(200).json({ data: consultations });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const consultation = await getConsultationById(
      req.params.id,
      req.user
    );

    res.status(200).json({ data: consultation });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/status", async (req, res, next) => {
  try {
    const validation = statusSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: "Invalid consultation status",
        details: validation.error.issues,
      });
    }

    const consultation = await updateConsultationStatus(
      req.params.id,
      { ...req.user, requestId: req.requestId },
      validation.data.status
    );

    res.status(200).json({ data: consultation });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
