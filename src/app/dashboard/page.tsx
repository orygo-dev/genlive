import {
  Clock3,
  Users,
  Video,
} from "lucide-react";
import { DashboardActions } from "@/components/dashboard-actions";
import { DashboardShell } from "@/components/dashboard-shell";
import { MeetingHistory } from "@/components/meeting-history";
import { requireActiveMembership } from "@/lib/dashboard-guard";
import { prisma } from "@/lib/db";
import { getPlatformBranding } from "@/lib/platform-settings";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const context = await requireActiveMembership();
  const branding = await getPlatformBranding();

  const { user, activeMembership } = context;
  const organizationName = activeMembership.organization.name;
  const organizationId = activeMembership.organization.id;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [recentMeetings, monthlyMeetingCount, memberCount, durationAggregate] =
    await Promise.all([
      prisma.meeting.findMany({
        where: { organizationId },
        orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
        take: 40,
        select: {
          id: true,
          title: true,
          roomName: true,
          status: true,
          startsAt: true,
          createdAt: true,
          createdById: true,
          _count: {
            select: {
              participants: { where: { joinedAt: { not: null } } },
            },
          },
        },
      }),
      prisma.meeting.count({
        where: { organizationId, createdAt: { gte: monthStart } },
      }),
      prisma.organizationMember.count({ where: { organizationId } }),
      prisma.meetingParticipant.aggregate({
        where: { meeting: { organizationId } },
        _sum: { durationSeconds: true },
      }),
    ]);
  const totalMinutes = Math.round(
    (durationAggregate._sum.durationSeconds ?? 0) / 60,
  );

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
      activeNav="meeting"
      branding={branding}
    >
      <header className="dashboard-header">
        <div>
          <p>{organizationName}</p>
          <h1>Selamat datang, {user.name.split(" ")[0]}</h1>
        </div>
        <DashboardActions organizationId={organizationId} />
      </header>

      <section className="dashboard-stats" aria-label="Ringkasan meeting">
        <article>
          <span><Video size={19} /></span>
          <div><strong>{monthlyMeetingCount}</strong><p>Meeting bulan ini</p></div>
        </article>
        <article>
          <span><Clock3 size={19} /></span>
          <div><strong>{totalMinutes} menit</strong><p>Total durasi peserta</p></div>
        </article>
        <article>
          <span><Users size={19} /></span>
          <div><strong>{memberCount}</strong><p>Anggota workspace</p></div>
        </article>
      </section>

      <section className="dashboard-content">
        <div className="dashboard-section-heading">
          <div>
            <h2>Meeting terbaru</h2>
            <p>Kelola, mulai, atau bagikan tautan undangan meeting Anda.</p>
          </div>
        </div>
        <MeetingHistory
          currentUserId={user.id}
          currentRole={activeMembership.role}
          organizationId={organizationId}
          meetings={recentMeetings.map((meeting) => ({
            id: meeting.id,
            title: meeting.title,
            roomName: meeting.roomName,
            status: meeting.status,
            startsAt: meeting.startsAt?.toISOString() ?? null,
            createdAt: meeting.createdAt.toISOString(),
            createdById: meeting.createdById,
            participantCount: meeting._count.participants,
          }))}
        />
      </section>
    </DashboardShell>
  );
}
