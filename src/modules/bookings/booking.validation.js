const { z } = require("zod");

const createBookingSchema = z.object({
  slotId: z.string().uuid(),
  idempotencyKey: z.string().trim().min(16).max(128),
});

module.exports = {
  createBookingSchema,
};
