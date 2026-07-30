import { describe, expect, it } from "vitest";
import {
  canManageMembers,
  createInviteToken,
  createOrganizationSlug,
  hashInviteToken,
  resolveActiveOrganization,
  roleLabel,
} from "./organization-helpers";

describe("organization helpers", () => {
  it("allows only owners and admins to manage members", () => {
    expect(canManageMembers("OWNER")).toBe(true);
    expect(canManageMembers("ADMIN")).toBe(true);
    expect(canManageMembers("MEMBER")).toBe(false);
  });

  it("resolves the active organization when the membership exists", () => {
    const user = {
      id: "u1",
      name: "Anisa",
      email: "anisa@example.com",
      memberships: [
        {
          id: "m1",
          role: "OWNER" as const,
          joinedAt: new Date("2026-01-01"),
          organization: { id: "org-1", name: "Alpha", slug: "alpha" },
        },
        {
          id: "m2",
          role: "ADMIN" as const,
          joinedAt: new Date("2026-02-01"),
          organization: { id: "org-2", name: "Beta", slug: "beta" },
        },
      ],
    };

    expect(resolveActiveOrganization(user, "org-2")?.organization.id).toBe(
      "org-2",
    );
    expect(resolveActiveOrganization(user, "missing")?.organization.id).toBe(
      "org-1",
    );
  });

  it("hashes invite tokens consistently", () => {
    const { token, tokenHash } = createInviteToken();
    expect(hashInviteToken(token)).toBe(tokenHash);
  });

  it("creates stable organization slug prefixes", () => {
    const slug = createOrganizationSlug("Tim Produk GenMeet");
    expect(slug.startsWith("tim-produk-genmeet-")).toBe(true);
    expect(slug.length).toBeGreaterThan("tim-produk-genmeet-".length);
  });

  it("labels roles for display", () => {
    expect(roleLabel("OWNER")).toBe("Owner");
    expect(roleLabel("ADMIN")).toBe("Admin");
    expect(roleLabel("MEMBER")).toBe("Member");
  });
});
