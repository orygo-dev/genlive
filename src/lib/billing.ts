import "server-only";

import { prisma } from "@/lib/db";
import { getPlan, type PlanCodeValue } from "@/lib/plans";
import { writeAuditLog } from "@/lib/organization";

function monthWindow(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  end.setHours(0, 0, 0, 0);
  return { start, end };
}

export async function resolveOrganizationPlan(organizationId: string) {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      planCode: true,
      planExpiresAt: true,
    },
  });

  if (!organization) {
    return null;
  }

  let planCode = organization.planCode as PlanCodeValue;
  if (
    planCode === "PRO" &&
    organization.planExpiresAt &&
    organization.planExpiresAt.getTime() < Date.now()
  ) {
    await prisma.organization.update({
      where: { id: organizationId },
      data: { planCode: "FREE" },
    });
    planCode = "FREE";
  }

  return {
    organizationId,
    planCode,
    planExpiresAt: organization.planExpiresAt,
    plan: getPlan(planCode),
  };
}

export async function getOrganizationUsage(organizationId: string) {
  const { start, end } = monthWindow();
  const [memberCount, meetingCount, meetingMinutes, recordingMinutes] =
    await Promise.all([
      prisma.organizationMember.count({ where: { organizationId } }),
      prisma.meeting.count({
        where: {
          organizationId,
          createdAt: { gte: start, lt: end },
        },
      }),
      prisma.meetingParticipant.aggregate({
        where: {
          meeting: {
            organizationId,
            createdAt: { gte: start, lt: end },
          },
        },
        _sum: { durationSeconds: true },
      }),
      prisma.recording.aggregate({
        where: {
          organizationId,
          startedAt: { gte: start, lt: end },
          status: "COMPLETE",
        },
        _sum: { durationSeconds: true },
      }),
    ]);

  return {
    memberCount,
    meetingCount,
    meetingMinutes: Math.round((meetingMinutes._sum.durationSeconds ?? 0) / 60),
    recordingMinutes: Math.round(
      (recordingMinutes._sum.durationSeconds ?? 0) / 60,
    ),
  };
}

export async function assertCanInviteMember(organizationId: string) {
  const resolved = await resolveOrganizationPlan(organizationId);
  if (!resolved) {
    return { ok: false as const, error: "Organisasi tidak ditemukan.", status: 404 };
  }
  const usage = await getOrganizationUsage(organizationId);
  if (usage.memberCount >= resolved.plan.maxMembers) {
    return {
      ok: false as const,
      error: `Batas anggota plan ${resolved.plan.name} tercapai (${resolved.plan.maxMembers}). Upgrade ke Pro untuk menambah anggota.`,
      status: 402,
    };
  }
  return { ok: true as const, plan: resolved.plan };
}

export async function assertCanCreateMeeting(organizationId: string) {
  const resolved = await resolveOrganizationPlan(organizationId);
  if (!resolved) {
    return { ok: false as const, error: "Organisasi tidak ditemukan.", status: 404 };
  }
  const usage = await getOrganizationUsage(organizationId);
  if (usage.meetingCount >= resolved.plan.maxMeetingsPerMonth) {
    return {
      ok: false as const,
      error: `Batas meeting bulanan plan ${resolved.plan.name} tercapai (${resolved.plan.maxMeetingsPerMonth}).`,
      status: 402,
    };
  }
  return { ok: true as const, plan: resolved.plan };
}

export async function assertCanStartRecording(organizationId: string) {
  const resolved = await resolveOrganizationPlan(organizationId);
  if (!resolved) {
    return { ok: false as const, error: "Organisasi tidak ditemukan.", status: 404 };
  }
  if (resolved.plan.maxRecordingMinutesPerMonth <= 0) {
    return {
      ok: false as const,
      error: "Recording cloud tersedia di plan Pro. Upgrade untuk mulai merekam.",
      status: 402,
    };
  }
  const usage = await getOrganizationUsage(organizationId);
  if (usage.recordingMinutes >= resolved.plan.maxRecordingMinutesPerMonth) {
    return {
      ok: false as const,
      error: `Batas menit recording plan ${resolved.plan.name} tercapai.`,
      status: 402,
    };
  }
  return { ok: true as const, plan: resolved.plan };
}

export async function activatePaidPlan(input: {
  organizationId: string;
  planCode: PlanCodeValue;
  actorId?: string | null;
  orderId: string;
  provider: string;
}) {
  const plan = getPlan(input.planCode);
  const expiresAt =
    plan.billingPeriodDays > 0
      ? new Date(Date.now() + plan.billingPeriodDays * 24 * 60 * 60 * 1000)
      : null;

  await prisma.organization.update({
    where: { id: input.organizationId },
    data: {
      planCode: input.planCode,
      planExpiresAt: expiresAt,
    },
  });

  await writeAuditLog({
    organizationId: input.organizationId,
    actorId: input.actorId ?? null,
    action: "billing.plan_activated",
    targetType: "payment_order",
    targetId: input.orderId,
    metadata: {
      planCode: input.planCode,
      provider: input.provider,
      expiresAt: expiresAt?.toISOString() ?? null,
    },
  });
}
