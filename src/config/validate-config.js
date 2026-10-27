function validateConfig(env = process.env) {
  const required = ["DATABASE_URL", "JWT_SECRET"];

  const missing = required.filter(
    (key) => !env[key] || !env[key].trim()
  );

  if (env.NODE_ENV === "production" && !env.METRICS_TOKEN?.trim()) {
    missing.push("METRICS_TOKEN");
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }

  if (
    env.NODE_ENV === "production" &&
    env.JWT_SECRET.length < 32
  ) {
    throw new Error("JWT_SECRET must be at least 32 characters in production");
  }
}

module.exports = { validateConfig };
