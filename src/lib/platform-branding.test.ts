import { describe, expect, it } from "vitest";
import { defaultPlatformBranding, DEFAULT_APP_NAME } from "./platform-branding";
import { getConfiguredSuperAdminEmails } from "./super-admin-emails";

describe("platform branding defaults", () => {
  it("falls back to GenMeet", () => {
    expect(DEFAULT_APP_NAME).toBe("GenMeet");
    expect(defaultPlatformBranding.appName).toBe("GenMeet");
    expect(defaultPlatformBranding.logoUrl).toBeNull();
  });
});

describe("super admin emails", () => {
  it("parses comma-separated emails", () => {
    expect(
      getConfiguredSuperAdminEmails("Admin@Example.com, other@x.com"),
    ).toEqual(["admin@example.com", "other@x.com"]);
  });
});
