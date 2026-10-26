const { z } = require("zod");

const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(8).max(72),
  role: z.enum(["PATIENT", "DOCTOR"]).default("PATIENT"),

  specialization: z.string().trim().min(2).max(120).optional(),
  licenseNumber: z.string().trim().min(1).max(100).optional(),
  consultationFee: z.coerce.number().positive().max(99999999).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(1).max(72),
});

module.exports = {
  registerSchema,
  loginSchema,
};
