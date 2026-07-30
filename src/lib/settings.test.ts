import { describe, expect, it } from "vitest";
import {
  changePasswordSchema,
  createOrganizationSchema,
  deleteOrganizationSchema,
  updateProfileSchema,
} from "./auth-validation";
import { auditActionLabel } from "./organization-labels";

describe("settings validation", () => {
  it("accepts a valid profile name", () => {
    expect(updateProfileSchema.parse({ name: "Budi Santoso" })).toEqual({
      name: "Budi Santoso",
    });
  });

  it("rejects weak password changes", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "OldPass1",
      newPassword: "short",
    });
    expect(result.success).toBe(false);
  });

  it("requires workspace confirmation name", () => {
    expect(
      deleteOrganizationSchema.parse({ confirmName: "Acme Workspace" }),
    ).toEqual({ confirmName: "Acme Workspace" });
    expect(createOrganizationSchema.parse({ name: "Baru" })).toEqual({
      name: "Baru",
    });
  });

  it("labels organization audit actions", () => {
    expect(auditActionLabel("organization.updated")).toBe(
      "Memperbarui workspace",
    );
    expect(auditActionLabel("member.left")).toBe("Keluar dari workspace");
  });
});
