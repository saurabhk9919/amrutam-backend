
jest.mock("../src/config/database", () => ({
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  doctor: {
    findUnique: jest.fn(),
  },
  availabilitySlot: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
}));

jest.mock("bcrypt", () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

const bcrypt = require("bcrypt");
const prisma = require("../src/config/database");
const {
  registerUser,
  loginUser,
} = require("../src/modules/auth/auth.service");
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
        isVerified: true,
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

    test("rejects availability creation for an unverified doctor", async () => {
      prisma.doctor.findUnique.mockResolvedValue({
        id: "doctor-123",
        userId,
        isVerified: false,
      });

      await expect(
        createAvailability(userId, {
          startTime,
          endTime,
        })
      ).rejects.toMatchObject({
        message: "Doctor is not verified",
        statusCode: 403,
      });

      expect(prisma.availabilitySlot.create).not.toHaveBeenCalled();
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
          doctor: {
            isVerified: true,
          },
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
          doctor: {
            isVerified: true,
          },
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
          doctor: {
            isVerified: true,
          },
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
          doctor: {
            isVerified: true,
          },
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

  describe("registerUser", () => {
    test("rejects ADMIN registration at the service layer", async () => {
      await expect(
        registerUser({
          name: "Test Admin",
          email: "admin@example.com",
          password: "Password123!",
          role: "ADMIN",
        })
      ).rejects.toMatchObject({
        message: "Invalid registration role",
        statusCode: 400,
      });

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(bcrypt.hash).not.toHaveBeenCalled();
    });
  });

  describe("loginUser", () => {
    beforeEach(() => {
      process.env.JWT_SECRET = "test-jwt-secret";
    });

    test("rejects inactive users even with a valid password", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "user-123",
        email: "inactive@example.com",
        role: "PATIENT",
        passwordHash: "hashed-password",
        isActive: false,
      });
      bcrypt.compare.mockResolvedValue(true);

      await expect(
        loginUser({
          email: "inactive@example.com",
          password: "Password123!",
        })
      ).rejects.toMatchObject({
        message: "Invalid email or password",
        statusCode: 401,
      });
    });
  });
});
