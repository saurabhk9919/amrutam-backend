
const {
  registerSchema,
  loginSchema,
} = require("../src/modules/auth/auth.validation");

describe("Authentication validation", () => {
  describe("registerSchema", () => {
    it("accepts a valid patient registration", () => {
      const result = registerSchema.safeParse({
        name: "Test Patient",
        email: "patient@example.com",
        password: "StrongPassword123!",
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.role).toBe("PATIENT");
      }
    });

    it("rejects an invalid email", () => {
      const result = registerSchema.safeParse({
        name: "Test Patient",
        email: "not-an-email",
        password: "StrongPassword123!",
      });

      expect(result.success).toBe(false);
    });
  });

  describe("loginSchema", () => {
    it("rejects a missing password", () => {
      const result = loginSchema.safeParse({
        email: "patient@example.com",
      });

      expect(result.success).toBe(false);
    });
  });
});
