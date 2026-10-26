
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const authRoutes = require("./modules/auth/auth.routes");
const availabilityRoutes = require("./modules/availability/availability.routes");
const bookingRoutes = require("./modules/bookings/booking.routes");
const consultationRoutes = require("./modules/consultations/consultations.routes");
const prescriptionRoutes = require("./modules/prescriptions/prescription.routes");

const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "100kb" }));
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/availability", availabilityRoutes);
app.use("/api/v1/bookings", bookingRoutes);
app.use("/api/v1/consultations", prescriptionRoutes);
app.use("/api/v1/consultations", consultationRoutes);

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  })
);

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "amrutam-telemedicine-backend",
  });
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  console.error(err.message);

  if (err.code === "P2002") {
    return res.status(409).json({
      error: "Resource conflicts with an existing record",
    });
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: err.statusCode ? err.message : "Internal server error",
  });
});

module.exports = app;
