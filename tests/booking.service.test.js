
jest.mock("../src/config/database", () => ({
  idempotencyKey: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(),
}));

const prisma = require("../src/config/database");
const { createBooking } = require("../src/modules/bookings/booking.service");

describe("Booking service", () => {
  const patientUserId = "316532a9-5982-4728-8efe-b798713835c3";
  const slotId = "c52802c2-f832-4ca4-9a18-522e5b6e1a31";
  const idempotencyKey = "booking-request-123456";

  let tx;

  beforeEach(() => {
    jest.clearAllMocks();

    tx = {
      idempotencyKey: {
        create: jest.fn(),
        update: jest.fn(),
      },
      availabilitySlot: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      consultation: {
        create: jest.fn(),
      },
    };

    prisma.$transaction.mockImplementation(async (callback) =>
      callback(tx)
    );
  });

  it("returns the cached response for a repeated request", async () => {
    const cachedBody = {
      message: "Consultation booked successfully",
      consultation: { id: "consultation-123" },
    };

    prisma.idempotencyKey.findUnique.mockResolvedValue({
      requestHash: require("crypto")
        .createHash("sha256")
        .update(JSON.stringify({ slotId }))
        .digest("hex"),
      responseStatus: 201,
      responseBody: cachedBody,
    });

    const result = await createBooking(patientUserId, {
      slotId,
      idempotencyKey,
    });

    expect(result).toEqual({
      statusCode: 201,
      body: cachedBody,
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects reuse of an idempotency key for another request", async () => {
    prisma.idempotencyKey.findUnique.mockResolvedValue({
      requestHash: "different-request-hash",
      responseStatus: 201,
      responseBody: { message: "Earlier request" },
    });

    await expect(
      createBooking(patientUserId, {
        slotId,
        idempotencyKey,
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "Idempotency key was already used for another request",
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects booking when the doctor is not verified", async () => {
    prisma.idempotencyKey.findUnique.mockResolvedValue(null);

    tx.availabilitySlot.findUnique.mockResolvedValue({
      id: slotId,
      status: "OPEN",
      startTime: new Date(Date.now() + 60 * 60 * 1000),
      doctor: { isVerified: false },
    });

    await expect(
      createBooking(patientUserId, {
        slotId,
        idempotencyKey,
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "Doctor is not verified",
    });

    expect(tx.availabilitySlot.updateMany).not.toHaveBeenCalled();
    expect(tx.consultation.create).not.toHaveBeenCalled();
  });

  it("rejects a slot that is already booked", async () => {
    prisma.idempotencyKey.findUnique.mockResolvedValue(null);

    tx.availabilitySlot.findUnique.mockResolvedValue({
      id: slotId,
      status: "BOOKED",
      startTime: new Date(Date.now() + 60 * 60 * 1000),
      doctor: { isVerified: true },
    });

    await expect(
      createBooking(patientUserId, {
        slotId,
        idempotencyKey,
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "Availability slot is not available",
    });

    expect(tx.consultation.create).not.toHaveBeenCalled();
  });
});
