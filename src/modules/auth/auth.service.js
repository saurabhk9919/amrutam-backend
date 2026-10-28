const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require("../../config/database");

async function registerUser({
  name,
  email,
  password,
  role = "PATIENT",
  specialization,
  licenseNumber,
  consultationFee,
}) {
  if (!["PATIENT", "DOCTOR"].includes(role)) {
    const error = new Error("Invalid registration role");
    error.statusCode = 400;
    throw error;
  }

  if (role === "DOCTOR") {
    if (
      !specialization ||
      !licenseNumber ||
      consultationFee === undefined
    ) {
      const error = new Error(
        "Doctors must provide specialization, licenseNumber, and consultationFee"
      );
      error.statusCode = 400;
      throw error;
    }
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    const error = new Error("Email is already registered");
    error.statusCode = 409;
    throw error;
  }

  if (role === "DOCTOR") {
    const existingLicense = await prisma.doctor.findUnique({
      where: { licenseNumber },
    });

    if (existingLicense) {
      const error = new Error("License number is already registered");
      error.statusCode = 409;
      throw error;
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role,
      profile: {
        create: {
          fullName: name,
        },
      },
      ...(role === "DOCTOR"
        ? {
            doctor: {
              create: {
                specialization,
                licenseNumber,
                consultationFee,
              },
            },
          }
        : {}),
    },
    select: {
      id: true,
      email: true,
      role: true,
      profile: {
        select: {
          fullName: true,
        },
      },
      doctor: role === "DOCTOR"
        ? {
            select: {
              id: true,
              specialization: true,
              licenseNumber: true,
              consultationFee: true,
              isVerified: true,
            },
          }
        : false,
    },
  });

  return user;
}

async function loginUser({ email, password }) {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (
    !user ||
    !(await bcrypt.compare(password, user.passwordHash)) ||
    !user.isActive
  ) {
    const error = new Error("Invalid email or password");
    error.statusCode = 401;
    throw error;
  }

  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  const token = jwt.sign(
    { sub: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  };
}

module.exports = {
  registerUser,
  loginUser,
};
