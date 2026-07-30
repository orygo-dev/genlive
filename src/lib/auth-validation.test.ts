import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "./auth-validation";

describe("registerSchema", () => {
  it("normalizes a valid registration", () => {
    const result = registerSchema.parse({
      name: "  Anisa Putri ",
      organizationName: " GenMeet Indonesia ",
      email: " ANISA@EXAMPLE.COM ",
      password: "AmanSekali123",
    });

    expect(result).toEqual({
      name: "Anisa Putri",
      organizationName: "GenMeet Indonesia",
      email: "anisa@example.com",
      password: "AmanSekali123",
    });
  });

  it("rejects a weak password", () => {
    const result = registerSchema.safeParse({
      name: "Anisa",
      organizationName: "GenMeet",
      email: "anisa@example.com",
      password: "password",
    });

    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("does not enforce registration complexity during login", () => {
    const result = loginSchema.safeParse({
      email: "member@example.com",
      password: "legacy-password",
    });

    expect(result.success).toBe(true);
  });
});
