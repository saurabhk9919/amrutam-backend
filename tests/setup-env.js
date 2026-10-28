const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

// 1. Safety Guard: Prevent tests from ever running in production mode
if (process.env.NODE_ENV === "production") {
  throw new Error(
    "Safety Guard: Cannot run tests with NODE_ENV=production. Integration tests perform destructive database cleanup."
  );
}

process.env.NODE_ENV = "test";

// 2. Load .env.test if it exists on disk, but do not override explicitly provided CI/CLI environment variables
const envTestPath = path.resolve(__dirname, "../.env.test");
if (fs.existsSync(envTestPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envTestPath));
  for (const key in envConfig) {
    const currentVal = process.env[key];
    // Set if missing, or if DATABASE_URL was loaded from .env with unreachable docker hostname db:5432
    if (!currentVal || (key === "DATABASE_URL" && currentVal.includes("@db:5432"))) {
      process.env[key] = envConfig[key];
    }
  }
}

// 3. Fallback defaults for local test execution
if (
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL.includes("@db:5432")
) {
  process.env.DATABASE_URL =
    "postgresql://amrutam_test:local_test_password@localhost:5433/amrutam_test?schema=public";
}

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "test-jwt-secret-at-least-32-chars-long-for-testing";
}

if (!process.env.METRICS_TOKEN) {
  process.env.METRICS_TOKEN = "test-metrics-token-at-least-32-characters-long";
}

// 4. Safety Guard: Verify test database target before allowing tests to proceed
const dbUrl = process.env.DATABASE_URL || "";
const isTestDb =
  dbUrl.includes(":5433") ||
  dbUrl.includes("amrutam_test") ||
  dbUrl.includes("test");

if (!isTestDb) {
  throw new Error(
    `Safety Guard: Refusing to run tests against database URL "${dbUrl}". Tests must target a test database.`
  );
}
