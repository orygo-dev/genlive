import "server-only";

import { getOrganizationUsage } from "@/lib/billing";
import { prisma } from "@/lib/db";

function monthBuckets(count = 6, now = new Date()) {
  const buckets: Array<{ key: string; label: string; start: Date; end: Date }> =
    [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1);
    end.setHours(0, 0, 0, 0);
    const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
    const label = new Intl.DateTimeFormat("id-ID", {
      month: "short",
      year: "numeric",
    }).format(start);
    buckets.push({ key, label, start, end });
  }
  return buckets;
}

export async function getOrganizationAnalytics(organizationId: string) {
  const buckets = monthBuckets();
  const rangeStart = buckets[0]?.start ?? new Date();

  const [usage, meetings, participants, recordings, recentMeetings] =
    await Promise.all([
      getOrganizationUsage(organizationId),
      prisma.meeting.findMany({
        where: {
          organizationId,
          createdAt: { gte: rangeStart },
        },
        select: { id: true, createdAt: true },
      }),
      prisma.meetingParticipant.findMany({
        where: {
          meeting: {
            organizationId,
            createdAt: { gte: rangeStart },
          },
        },
        select: {
          durationSeconds: true,
          meeting: { select: { createdAt: true } },
        },
      }),
      prisma.recording.findMany({
        where: {
          organizationId,
          startedAt: { gte: rangeStart },
          status: "COMPLETE",
        },
        select: { id: true, startedAt: true },
      }),
      prisma.meeting.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          title: true,
          status: true,
          startsAt: true,
          createdAt: true,
          endedAt: true,
          _count: { select: { participants: true, recordings: true } },
        },
      }),
    ]);

  const monthly = buckets.map((bucket) => {
    const meetingCount = meetings.filter(
      (item) => item.createdAt >= bucket.start && item.createdAt < bucket.end,
    ).length;

    const participantMinutes = Math.round(
      participants
        .filter(
          (item) =>
            item.meeting.createdAt >= bucket.start &&
            item.meeting.createdAt < bucket.end,
        )
        .reduce((sum, item) => sum + item.durationSeconds, 0) / 60,
    );

    const recordingCount = recordings.filter(
      (item) => item.startedAt >= bucket.start && item.startedAt < bucket.end,
    ).length;

    return {
      month: bucket.key,
      label: bucket.label,
      meetingCount,
      participantMinutes,
      recordingCount,
    };
  });

  return {
    usageThisMonth: usage,
    monthly,
    recentMeetings: recentMeetings.map((meeting) => ({
      id: meeting.id,
      title: meeting.title,
      status: meeting.status,
      startsAt: meeting.startsAt,
      createdAt: meeting.createdAt,
      endedAt: meeting.endedAt,
      participantCount: meeting._count.participants,
      recordingCount: meeting._count.recordings,
    })),
  };
}

export function analyticsToCsv(
  analytics: Awaited<ReturnType<typeof getOrganizationAnalytics>>,
) {
  const lines = [
    "bulan,label,meeting,peserta_menit,recording",
    ...analytics.monthly.map(
      (row) =>
        `${row.month},${row.label},${row.meetingCount},${row.participantMinutes},${row.recordingCount}`,
    ),
  ];
  return `${lines.join("\n")}\n`;
}
