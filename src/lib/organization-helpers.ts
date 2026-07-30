import { createHash, randomBytes, randomUUID } from "node:crypto";
import { roleLabel, type OrgRoleLabel } from "./organization-labels";

export function createOrganizationSlug(name: string) {
  const base =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "workspace";

  return `${base}-${randomUUID().slice(0, 8)}`;
}

export type Membership = {
  id: string;
  role: OrgRoleLabel;
  joinedAt: Date;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
};

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  isSuperAdmin?: boolean;
  memberships: Membership[];
};

export function canManageMembers(role: OrgRoleLabel) {
  return role === "OWNER" || role === "ADMIN";
}

export function getMembership(
  user: SessionUser,
  organizationId: string,
): Membership | undefined {
  return user.memberships.find(
    (membership) => membership.organization.id === organizationId,
  );
}

export function resolveActiveOrganization(
  user: SessionUser,
  activeOrganizationId?: string | null,
) {
  if (
    activeOrganizationId &&
    user.memberships.some(
      (membership) => membership.organization.id === activeOrganizationId,
    )
  ) {
    return (
      user.memberships.find(
        (membership) => membership.organization.id === activeOrganizationId,
      ) ?? null
    );
  }

  return user.memberships[0] ?? null;
}

export function createInviteToken() {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    tokenHash: createHash("sha256").update(token).digest("hex"),
  };
}

export function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export { roleLabel };
