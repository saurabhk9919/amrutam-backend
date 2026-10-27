const { validateConfig } = require("../src/config/validate-config");

describe("validateConfig", () => {
  const validConfig = {
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://user:pass@localhost:5432/testdb",
    JWT_SECRET: "test-jwt-secret",
  };

  test("accepts valid configuration outside production", () => {
    expect(() => validateConfig(validConfig)).not.toThrow();
  });

  test("rejects missing required variables", () => {
    expect(() =>
      validateConfig({
        NODE_ENV: "test",
        DATABASE_URL: "",
      })
    ).toThrow(/JWT_SECRET/);
  });

  test("requires METRICS_TOKEN in production", () => {
    expect(() =>
      validateConfig({
        NODE_ENV: "production",
        DATABASE_URL: validConfig.DATABASE_URL,
        JWT_SECRET: "a".repeat(32),
      })
    ).toThrow(/METRICS_TOKEN/);
  });

  test("rejects short JWT secrets in production", () => {
    expect(() =>
      validateConfig({
        NODE_ENV: "production",
        DATABASE_URL: validConfig.DATABASE_URL,
        JWT_SECRET: "too-short",
        METRICS_TOKEN: "test-metrics-token",
      })
    ).toThrow(/at least 32 characters/);
  });

  test("accepts valid production configuration", () => {
    expect(() =>
      validateConfig({
        NODE_ENV: "production",
        DATABASE_URL: validConfig.DATABASE_URL,
        JWT_SECRET: "a".repeat(32),
        METRICS_TOKEN: "test-metrics-token",
      })
    ).not.toThrow();
  });
});
