
const express = require("express");

const {
  registerSchema,
  loginSchema,
} = require("./auth.validation");

const {
  registerUser,
  loginUser,
} = require("./auth.service");

const {
  authenticateToken,
} = require("../../middleware/auth.middleware");

const router = express.Router();

router.post("/register", async (req, res, next) => {
  try {
    const result = registerSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: result.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const user = await registerUser(result.data);

    return res.status(201).json({
      message: "User registered successfully",
      user,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const result = loginSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: result.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const data = await loginUser(result.data);

    return res.status(200).json({
      message: "Login successful",
      ...data,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/me", authenticateToken, async (req, res, next) => {
  try {
    const user = await require("../../config/database").user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        role: true,
        profile: {
          select: {
            fullName: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    return res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
