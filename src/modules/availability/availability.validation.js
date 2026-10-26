
const { z } = require("zod");

const createAvailabilitySchema = z.object({
  startTime: z.string().datetime({ offset: true }),
  endTime: z.string().datetime({ offset: true }),
});

module.exports = {
  createAvailabilitySchema,
};
