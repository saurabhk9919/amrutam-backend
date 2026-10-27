
const {
  createBookingSchema,
} = require("../src/modules/bookings/booking.validation");

describe("Booking validation", () => {
  it("accepts a valid booking request", () => {
    const result = createBookingSchema.safeParse({
      slotId: "c52802c2-f832-4ca4-9a18-522e5b6e1a31",
      idempotencyKey: "booking-request-123456",
    });

    expect(result.success).toBe(true);
  });

  it("rejects an invalid slot ID", () => {
    const result = createBookingSchema.safeParse({
      slotId: "invalid-id",
      idempotencyKey: "booking-request-123456",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a short idempotency key", () => {
    const result = createBookingSchema.safeParse({
      slotId: "c52802c2-f832-4ca4-9a18-522e5b6e1a31",
      idempotencyKey: "short",
    });

    expect(result.success).toBe(false);
  });
});
