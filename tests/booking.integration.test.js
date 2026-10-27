const { randomUUID } = require("crypto");

const prisma = require("../src/config/database");
const { createBooking } = require("../src/modules/bookings/booking.service");

describe("Booking integration tests (PostgreSQL)", () => {
  let patient1;
  let patient2;
  let doctorUser;
  let doctor;
  let slot;

  const createdUserIds = [];

  async function createUser(email, role = "PATIENT") {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: "integration-test-hash",
        role,
      },
    });

    createdUserIds.push(user.id);
    return user;
  }

  async function createSlot() {
    const startTime = new Date(Date.now() + 24 * 60 * 60 * 1000);

    return prisma.availabilitySlot.create({
      data: {
        doctorId: doctor.id,
        startTime,
        endTime: new Date(startTime.getTime() + 30 * 60 * 1000),
      },
    });
  }

  beforeEach(async () => {
    patient1 = await createUser(`patient1-${randomUUID()}@test.invalid`);
    patient2 = await createUser(`patient2-${randomUUID()}@test.invalid`);
    doctorUser = await createUser(`doctor-${randomUUID()}@test.invalid`, "DOCTOR");

    doctor = await prisma.doctor.create({
      data: {
        userId: doctorUser.id,
        specialization: "General Medicine",
        licenseNumber: `TEST-${randomUUID()}`,
        consultationFee: "500.00",
        isVerified: true,
      },
    });

    slot = await createSlot();
  });

  afterEach(async () => {
    await prisma.idempotencyKey.deleteMany({
      where: { userId: { in: createdUserIds } },
    });

    await prisma.consultation.deleteMany({
      where: {
        OR: [
          { patientId: { in: createdUserIds } },
          { slotId: slot?.id },
        ],
      },
    });

    if (slot?.id) {
      await prisma.availabilitySlot.deleteMany({ where: { id: slot.id } });
    }

    if (doctor?.id) {
      await prisma.doctor.deleteMany({ where: { id: doctor.id } });
    }

    await prisma.user.deleteMany({
      where: { id: { in: createdUserIds } },
    });

    createdUserIds.length = 0;
    slot = undefined;
    doctor = undefined;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates and persists a booking", async () => {
    const result = await createBooking(patient1.id, {
      slotId: slot.id,
      idempotencyKey: `booking-${randomUUID()}`,
    });

    expect(result.statusCode).toBe(201);
    expect(result.body.consultation.slotId).toBe(slot.id);

    const persisted = await prisma.consultation.findUnique({
      where: { slotId: slot.id },
    });

    const updatedSlot = await prisma.availabilitySlot.findUnique({
      where: { id: slot.id },
    });

    expect(persisted.patientId).toBe(patient1.id);
    expect(updatedSlot.status).toBe("BOOKED");
  });

  it("replays the stored response for the same idempotency key", async () => {
    const idempotencyKey = `booking-${randomUUID()}`;

    const first = await createBooking(patient1.id, {
      slotId: slot.id,
      idempotencyKey,
    });

    const second = await createBooking(patient1.id, {
      slotId: slot.id,
      idempotencyKey,
    });

    expect(second).toEqual(JSON.parse(JSON.stringify(first)));

    const count = await prisma.consultation.count({
      where: { slotId: slot.id },
    });

    expect(count).toBe(1);
  });

  it("rejects reuse of an idempotency key with a different request", async () => {
    const idempotencyKey = `booking-${randomUUID()}`;
    const anotherSlot = await createSlot();

    try {
      await createBooking(patient1.id, {
        slotId: slot.id,
        idempotencyKey,
      });

      await expect(
        createBooking(patient1.id, {
          slotId: anotherSlot.id,
          idempotencyKey,
        })
      ).rejects.toMatchObject({ statusCode: 409 });
    } finally {
      await prisma.consultation.deleteMany({
        where: { slotId: anotherSlot.id },
      });
      await prisma.availabilitySlot.deleteMany({
        where: { id: anotherSlot.id },
      });
    }
  });

  it("replays the successful response for simultaneous requests with the same idempotency key", async () => {
    const idempotencyKey = `booking-${randomUUID()}`;

    const results = await Promise.allSettled([
      createBooking(patient1.id, {
        slotId: slot.id,
        idempotencyKey,
      }),
      createBooking(patient1.id, {
        slotId: slot.id,
        idempotencyKey,
      }),
    ]);

    const fulfilled = results.filter(
      (result) => result.status === "fulfilled"
    );
    const rejected = results.filter(
      (result) => result.status === "rejected"
    );

    expect(fulfilled).toHaveLength(2);
    expect(rejected).toHaveLength(0);

    expect(fulfilled[0].value.statusCode).toBe(201);
    expect(fulfilled[1].value.statusCode).toBe(201);

    expect(
      JSON.parse(JSON.stringify(fulfilled[0].value.body))
    ).toEqual(
      JSON.parse(JSON.stringify(fulfilled[1].value.body))
    );

    const count = await prisma.consultation.count({
      where: { slotId: slot.id },
    });

    expect(count).toBe(1);
  });

  it("allows only one patient to book a slot concurrently", async () => {
    const results = await Promise.allSettled([
      createBooking(patient1.id, {
        slotId: slot.id,
        idempotencyKey: `booking-${randomUUID()}`,
      }),
      createBooking(patient2.id, {
        slotId: slot.id,
        idempotencyKey: `booking-${randomUUID()}`,
      }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);

    const consultations = await prisma.consultation.count({
      where: { slotId: slot.id },
    });

    expect(consultations).toBe(1);
  });

  it("rolls back the idempotency record when booking fails", async () => {
    const idempotencyKey = `booking-${randomUUID()}`;

    await prisma.availabilitySlot.update({
      where: { id: slot.id },
      data: { status: "BOOKED" },
    });

    await expect(
      createBooking(patient1.id, {
        slotId: slot.id,
        idempotencyKey,
      })
    ).rejects.toMatchObject({ statusCode: 409 });

    const record = await prisma.idempotencyKey.findUnique({
      where: {
        userId_key: {
          userId: patient1.id,
          key: idempotencyKey,
        },
      },
    });

    expect(record).toBeNull();
  });
});
