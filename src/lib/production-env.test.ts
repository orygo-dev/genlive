import { describe, expect, it } from "vitest";
import {
  collectProductionEnvIssues,
  getBlockingProductionEnvIssues,
} from "./production-env";

const baseEnv = {
  NODE_ENV: "production",
  APP_URL: "https://app.genmeet.example",
  DATABASE_URL: "mysql://user:pass@host:3306/db",
  APP_ENCRYPTION_KEY: "test-encryption-key-32chars-min!!",
  LIVEKIT_URL: "wss://example.livekit.cloud",
  LIVEKIT_API_KEY: "key",
  LIVEKIT_API_SECRET: "secret",
} as const;

describe("production env checks", () => {
  it("requires https APP_URL and encryption key", () => {
    const issues = collectProductionEnvIssues({
      ...baseEnv,
      APP_URL: "http://localhost:3000",
    });

    expect(issues.some((issue) => issue.key === "APP_URL")).toBe(true);
  });

  it("passes a minimal valid production set without blocking issues", () => {
    expect(getBlockingProductionEnvIssues({ ...baseEnv })).toEqual([]);
  });

  it("allows LiveKit to be configured later via admin UI", () => {
    const { LIVEKIT_URL: _u, LIVEKIT_API_KEY: _k, LIVEKIT_API_SECRET: _s, ...withoutLivekit } =
      baseEnv;
    const issues = collectProductionEnvIssues(withoutLivekit);
    expect(issues.some((issue) => issue.key === "LIVEKIT" && issue.optional)).toBe(
      true,
    );
    expect(getBlockingProductionEnvIssues(withoutLivekit)).toEqual([]);
  });

  it("flags missing Midtrans credentials as optional", () => {
    const issues = collectProductionEnvIssues({
      ...baseEnv,
      PAYMENT_PROVIDER: "MIDTRANS",
    });

    expect(issues.some((issue) => issue.key === "MIDTRANS" && issue.optional)).toBe(
      true,
    );
  });

  it("flags missing iPaymu credentials as optional", () => {
    const issues = collectProductionEnvIssues({
      ...baseEnv,
      PAYMENT_PROVIDER: "IPAYMU",
    });

    expect(issues.some((issue) => issue.key === "IPAYMU" && issue.optional)).toBe(
      true,
    );
    expect(getBlockingProductionEnvIssues({
      ...baseEnv,
      PAYMENT_PROVIDER: "IPAYMU",
    })).toEqual([]);
  });

  it("warns when Midtrans production flag is off", () => {
    const issues = collectProductionEnvIssues({
      ...baseEnv,
      PAYMENT_PROVIDER: "MIDTRANS",
      MIDTRANS_SERVER_KEY: "Mid-server-x",
      MIDTRANS_CLIENT_KEY: "Mid-client-x",
      MIDTRANS_IS_PRODUCTION: "false",
    });

    expect(
      issues.some((issue) => issue.key === "MIDTRANS_IS_PRODUCTION" && issue.optional),
    ).toBe(true);
  });
});
