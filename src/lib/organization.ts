import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export {
  canManageMembers,
  createInviteToken,
  createOrganizationSlug,
  getMembership,
  hashInviteToken,
  resolveActiveOrganization,
  roleLabel,
  type Membership,
  type SessionUser,
} from "@/lib/organization-helpers";

export async function writeAuditLog(input: {
  organizationId: string;
  actorId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  await prisma.auditLog.create({
    data: {
      organizationId: input.organizationId,
      actorId: input.actorId ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      metadata: input.metadata,
    },
  });
}

export async function countOwners(organizationId: string) {
  return prisma.organizationMember.count({
    where: { organizationId, role: "OWNER" },
  });
}
