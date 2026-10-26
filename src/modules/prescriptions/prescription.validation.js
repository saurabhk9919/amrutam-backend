const { z } = require("zod");

const prescriptionSchema = z.object({
  details: z
    .array(
      z.object({
        medicine: z.string().trim().min(1).max(200),
        dosage: z.string().trim().min(1).max(100),
        frequency: z.string().trim().min(1).max(100),
        duration: z.string().trim().min(1).max(100),
        notes: z.string().trim().max(500).optional(),
      }).strict()
    )
    .min(1)
    .max(50),
  instructions: z.string().trim().max(5000).optional(),
}).strict();

module.exports = { prescriptionSchema };
