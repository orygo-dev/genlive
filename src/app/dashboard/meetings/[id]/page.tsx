import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { MeetingDetailPanel } from "@/components/meeting-detail-panel";
import { MeetingRecordingsPanel } from "@/components/meeting-recordings-panel";
import { requireActiveMembership } from "@/lib/dashboard-guard";
import { prisma } from "@/lib/db";
import { canManageMeeting, canViewMeeting } from "@/lib/meeting-access";
import { getPlatformBranding } from "@/lib/platform-settings";

export const dynamic = "force-dynamic";

type MeetingDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function MeetingDetailPage({
  params,
}: MeetingDetailPageProps) {
  const { id } = await params;
  const context = await requireActiveMembership();
  const branding = await getPlatformBranding();

  const meeting = await prisma.meeting.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      roomName: true,
      status: true,
      startsAt: true,
      actualStartedAt: true,
      endedAt: true,
      createdAt: true,
      waitingRoom: true,
      passwordHash: true,
      organizationId: true,
      createdById: true,
      createdBy: { select: { id: true, name: true, email: true } },
      _count: {
        select: {
          participants: { where: { joinedAt: { not: null } } },
        },
      },
      participants: {
        where: { joinedAt: { not: null } },
        orderBy: { joinedAt: "desc" },
        take: 20,
        select: {
          id: true,
          displayName: true,
          role: true,
          joinedAt: true,
          leftAt: true,
          durationSeconds: true,
        },
      },
    },
  });

  if (!meeting) {
    notFound();
  }

  if (!canViewMeeting(context.user, meeting)) {
    redirect("/dashboard");
  }

  const { passwordHash, ...rest } = meeting;

  return (
    <DashboardShell
      user={{
        name: context.user.name,
        email: context.user.email,
        isSuperAdmin: context.user.isSuperAdmin,
        emailVerifiedAt: context.user.emailVerifiedAt,
      }}
      memberships={context.user.memberships}
      activeOrganizationId={context.activeMembership.organization.id}
      activeNav="meeting"
      branding={branding}
    >
      <MeetingDetailPanel
        canManage={canManageMeeting(context.user, meeting)}
        meeting={{
          ...rest,
          passwordRequired: Boolean(passwordHash),
          startsAt: meeting.startsAt?.toISOString() ?? null,
          actualStartedAt: meeting.actualStartedAt?.toISOString() ?? null,
          endedAt: meeting.endedAt?.toISOString() ?? null,
          createdAt: meeting.createdAt.toISOString(),
          participants: meeting.participants.map((participant) => ({
            ...participant,
            joinedAt: participant.joinedAt?.toISOString() ?? null,
            leftAt: participant.leftAt?.toISOString() ?? null,
          })),
        }}
      />
      <div className="meeting-recordings-wrap">
        <MeetingRecordingsPanel
          meetingId={meeting.id}
          canManage={canManageMeeting(context.user, meeting)}
          meetingStatus={meeting.status}
        />
      </div>
    </DashboardShell>
  );
}
