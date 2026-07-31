import { DashboardShell } from "@/components/dashboard-shell";
import { MembersPanel } from "@/components/members-panel";
import { requireActiveMembership } from "@/lib/dashboard-guard";
import { prisma } from "@/lib/db";
import { canManageMembers } from "@/lib/organization-helpers";
import { getPlatformBranding } from "@/lib/platform-settings";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const context = await requireActiveMembership();
  const branding = await getPlatformBranding();

  const { user, activeMembership } = context;
  const organizationId = activeMembership.organization.id;
  const canManage = canManageMembers(activeMembership.role);
  const now = new Date();

  if (canManage) {
    await prisma.organizationInvitation.updateMany({
      where: {
        organizationId,
        status: "PENDING",
        expiresAt: { lte: now },
      },
      data: { status: "EXPIRED" },
    });
  }

  const [members, invitations, auditLogs] = await Promise.all([
    prisma.organizationMember.findMany({
      where: { organizationId },
      orderBy: [{ joinedAt: "asc" }],
      select: {
        id: true,
        role: true,
        joinedAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    canManage
      ? prisma.organizationInvitation.findMany({
          where: { organizationId },
          orderBy: { createdAt: "desc" },
          take: 40,
          select: {
            id: true,
            email: true,
            role: true,
            status: true,
            expiresAt: true,
            acceptedAt: true,
            createdAt: true,
            invitedBy: { select: { name: true, email: true } },
          },
        })
      : Promise.resolve([]),
    canManage
      ? prisma.auditLog.findMany({
          where: { organizationId },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            action: true,
            targetType: true,
            createdAt: true,
            metadata: true,
            actor: { select: { name: true, email: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  return (
    <DashboardShell
      user={{
        name: user.name,
        email: user.email,
        isSuperAdmin: user.isSuperAdmin,
        emailVerifiedAt: user.emailVerifiedAt,
      }}
      memberships={user.memberships}
      activeOrganizationId={organizationId}
      activeNav="members"
      branding={branding}
    >
      <header className="dashboard-header">
        <div>
          <p>{activeMembership.organization.name}</p>
          <h1>Anggota</h1>
        </div>
      </header>

      <MembersPanel
        currentUserId={user.id}
        currentRole={activeMembership.role}
        canManage={canManage}
        members={members.map((member) => ({
          ...member,
          joinedAt: member.joinedAt.toISOString(),
        }))}
        invitations={invitations.map((invitation) => ({
          ...invitation,
          expiresAt: invitation.expiresAt.toISOString(),
          acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
          createdAt: invitation.createdAt.toISOString(),
        }))}
        auditLogs={auditLogs.map((log) => ({
          ...log,
          createdAt: log.createdAt.toISOString(),
        }))}
      />
    </DashboardShell>
  );
}
