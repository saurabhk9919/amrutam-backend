
jest.mock("jsonwebtoken", () => ({
  verify: jest.fn(),
}));

const jwt = require("jsonwebtoken");
const {
  authenticateToken,
  authorizeRoles,
} = require("../src/middleware/auth.middleware");

describe("Authentication Middleware", () => {
  let req;
  let res;
  let next;
  let originalSecret;

  beforeEach(() => {
    jest.clearAllMocks();

    originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = "test-secret";

    req = { headers: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
  });

  describe("authenticateToken", () => {
    test("rejects a missing authorization header", () => {
      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: "Authentication token is required",
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("rejects a non-Bearer authorization header", () => {
      req.headers.authorization = "Basic abc123";

      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    test("rejects an empty Bearer token", () => {
      req.headers.authorization = "Bearer ";

      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    test("returns 500 when JWT_SECRET is missing", () => {
      delete process.env.JWT_SECRET;
      req.headers.authorization = "Bearer valid-token";

      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: "Authentication is not configured",
      });
      expect(jwt.verify).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    test("authenticates a valid token and attaches user details", () => {
      req.headers.authorization = "Bearer valid-token";

      jwt.verify.mockReturnValue({
        sub: "user-123",
        role: "PATIENT",
      });

      authenticateToken(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith(
        "valid-token",
        "test-secret"
      );
      expect(req.user).toEqual({
        id: "user-123",
        role: "PATIENT",
      });
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    test("rejects an invalid token", () => {
      req.headers.authorization = "Bearer invalid-token";
      jwt.verify.mockImplementation(() => {
        throw new Error("Invalid token");
      });

      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: "Invalid or expired token",
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("rejects an expired token", () => {
      req.headers.authorization = "Bearer expired-token";
      jwt.verify.mockImplementation(() => {
        const error = new Error("Token expired");
        error.name = "TokenExpiredError";
        throw error;
      });

      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: "Invalid or expired token",
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("authorizeRoles", () => {
    test("rejects requests without an authenticated user", () => {
      const authorize = authorizeRoles("ADMIN");

      authorize(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: "Authentication required",
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("allows a user with an authorized role", () => {
      req.user = {
        id: "doctor-123",
        role: "DOCTOR",
      };

      authorizeRoles("DOCTOR", "ADMIN")(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    test("rejects a user with an unauthorized role", () => {
      req.user = {
        id: "patient-123",
        role: "PATIENT",
      };

      authorizeRoles("DOCTOR", "ADMIN")(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: "You do not have permission to access this resource",
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
});

