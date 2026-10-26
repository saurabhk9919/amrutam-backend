
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const authRoutes = require("./modules/auth/auth.routes");
const availabilityRoutes = require("./modules/availability/availability.routes");

const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "100kb" }));
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/availability", availabilityRoutes);

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

  res.status(500).json({
    error: "Internal server error",
  });
});

module.exports = app;
