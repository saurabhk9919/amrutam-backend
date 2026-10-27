jest.mock("../src/modules/auth/auth.service", () => ({
  registerUser: jest.fn(),
  loginUser: jest.fn(),
}));

const express = require("express");
const request = require("supertest");

const { registerUser } = require("../src/modules/auth/auth.service");
const authRoutes = require("../src/modules/auth/auth.routes");

const app = express();
app.use(express.json());
app.use("/api/v1/auth", authRoutes);

describe("Auth Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("rejects public ADMIN registration", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Test Admin",
        email: "admin@example.com",
        password: "Password123!",
        role: "ADMIN",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Validation failed");
    expect(registerUser).not.toHaveBeenCalled();
  });

  test("defaults registration role to PATIENT", async () => {
    registerUser.mockResolvedValue({
      id: "user-123",
      email: "patient@example.com",
      role: "PATIENT",
    });

    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Test Patient",
        email: "patient@example.com",
        password: "Password123!",
      });

    expect(response.status).toBe(201);
    expect(registerUser).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "PATIENT",
        email: "patient@example.com",
      })
    );
  });
});
