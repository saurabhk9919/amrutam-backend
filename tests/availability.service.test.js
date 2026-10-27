
jest.mock("../src/config/database", () => ({
  doctor: {
    findUnique: jest.fn(),
  },
  availabilitySlot: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
}));

const prisma = require("../src/config/database");
const {
  createAvailability,
  listAvailableSlots,
} = require("../src/modules/availability/availability.service");

describe("Availability Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createAvailability", () => {
    const userId = "doctor-user-123";
    const startTime = "2026-11-01T10:00:00.000Z";
    const endTime = "2026-11-01T11:00:00.000Z";

    test("creates an availability slot successfully", async () => {
      const doctor = {
        id: "doctor-123",
        userId,
      };

      const createdSlot = {
        id: "slot-123",
        doctorId: doctor.id,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
      };

      prisma.doctor.findUnique.mockResolvedValue(doctor);
      prisma.availabilitySlot.create.mockResolvedValue(createdSlot);

      const result = await createAvailability(userId, {
        startTime,
        endTime,
      });

      expect(prisma.doctor.findUnique).toHaveBeenCalledWith({
        where: { userId },
      });

      expect(prisma.availabilitySlot.create).toHaveBeenCalledWith({
        data: {
          doctorId: doctor.id,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
        },
      });

      expect(result).toEqual(createdSlot);
    });

    test("rejects when end time is before start time", async () => {
      await expect(
        createAvailability(userId, {
          startTime: endTime,
          endTime: startTime,
        })
      ).rejects.toMatchObject({
        message: "End time must be after start time",
        statusCode: 400,
      });

      expect(prisma.doctor.findUnique).not.toHaveBeenCalled();
      expect(prisma.availabilitySlot.create).not.toHaveBeenCalled();
    });

    test("rejects when end time equals start time", async () => {
      await expect(
        createAvailability(userId, {
          startTime,
          endTime: startTime,
        })
      ).rejects.toMatchObject({
        statusCode: 400,
      });

      expect(prisma.doctor.findUnique).not.toHaveBeenCalled();
    });

    test("returns 404 when doctor profile does not exist", async () => {
      prisma.doctor.findUnique.mockResolvedValue(null);

      await expect(
        createAvailability(userId, {
          startTime,
          endTime,
        })
      ).rejects.toMatchObject({
        message: "Doctor profile not found",
        statusCode: 404,
      });

      expect(prisma.availabilitySlot.create).not.toHaveBeenCalled();
    });
  });

  describe("listAvailableSlots", () => {
    test("lists open slots ordered by start time", async () => {
      const slots = [
        { id: "slot-1", status: "OPEN" },
        { id: "slot-2", status: "OPEN" },
      ];

      prisma.availabilitySlot.findMany.mockResolvedValue(slots);

      const result = await listAvailableSlots({});

      expect(prisma.availabilitySlot.findMany).toHaveBeenCalledWith({
        where: {
          status: "OPEN",
        },
        orderBy: {
          startTime: "asc",
        },
      });

      expect(result).toEqual(slots);
    });

    test("filters slots by doctor ID", async () => {
      prisma.availabilitySlot.findMany.mockResolvedValue([]);

      await listAvailableSlots({
        doctorId: "doctor-123",
      });

      expect(prisma.availabilitySlot.findMany).toHaveBeenCalledWith({
        where: {
          status: "OPEN",
          doctorId: "doctor-123",
        },
        orderBy: {
          startTime: "asc",
        },
      });
    });

    test("filters slots by start and end date", async () => {
      prisma.availabilitySlot.findMany.mockResolvedValue([]);

      await listAvailableSlots({
        from: "2026-11-01T00:00:00.000Z",
        to: "2026-11-02T00:00:00.000Z",
      });

      expect(prisma.availabilitySlot.findMany).toHaveBeenCalledWith({
        where: {
          status: "OPEN",
          startTime: {
            gte: new Date("2026-11-01T00:00:00.000Z"),
            lt: new Date("2026-11-02T00:00:00.000Z"),
          },
        },
        orderBy: {
          startTime: "asc",
        },
      });
    });

    test("supports filtering by doctor ID and date range together", async () => {
      prisma.availabilitySlot.findMany.mockResolvedValue([]);

      await listAvailableSlots({
        doctorId: "doctor-123",
        from: "2026-11-01T00:00:00.000Z",
      });

      expect(prisma.availabilitySlot.findMany).toHaveBeenCalledWith({
        where: {
          status: "OPEN",
          doctorId: "doctor-123",
          startTime: {
            gte: new Date("2026-11-01T00:00:00.000Z"),
          },
        },
        orderBy: {
          startTime: "asc",
        },
      });
    });

    test("returns an empty array when no slots are available", async () => {
      prisma.availabilitySlot.findMany.mockResolvedValue([]);

      const result = await listAvailableSlots({});

      expect(result).toEqual([]);
    });
  });
});
