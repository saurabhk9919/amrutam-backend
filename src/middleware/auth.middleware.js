
const jwt = require("jsonwebtoken");
const prisma = require("../config/database");

async function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Authentication token is required",
    });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      error: "Authentication token is required",
    });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({
      error: "Authentication is not configured",
    });
  }

  let decoded;

  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({
      error: "Invalid or expired token",
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { isActive: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        error: "Invalid or expired token",
      });
    }

    req.user = {
      id: decoded.sub,
      role: decoded.role,
    };

    return next();
  } catch (error) {
    return next(error);
  }
}

function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: "You do not have permission to access this resource",
      });
    }

    next();
  };
}

module.exports = {
  authenticateToken,
  authorizeRoles,
};
