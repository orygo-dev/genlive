import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { getCurrentSessionContext } from "@/lib/auth";
import { assertCanCreateMeeting } from "@/lib/billing";
import { prisma } from "@/lib/db";
import { parseInviteEmails } from "@/lib/email-templates";
import { deliverMeetingInvites } from "@/lib/meeting-invites";
import { createRoomName } from "@/lib/meeting";
import { isFutureStart } from "@/lib/meeting-lifecycle";
import { writeAuditLog } from "@/lib/organization";
import { isValidInvitePhone, parseInvitePhones } from "@/lib/phone";

export const runtime = "nodejs";

const createMeetingSchema = z.object({
  organizationId: z.uuid().optional(),
  title: z.string().trim().min(2).max(120).optional(),
  startsAt: z.iso.datetime().optional(),
  waitingRoom: z.boolean().default(true),
  password: z.string().max(72).optional(),
  inviteEmails: z.union([z.string(), z.array(z.string())]).optional(),
  invitePhones: z.union([z.string(), z.array(z.string())]).optional(),
});

const listQuerySchema = z.object({
  status: z
    .enum(["SCHEDULED", "ACTIVE", "ENDED", "CANCELLED", "ALL"])
    .default("ALL"),
  take: z.coerce.number().int().min(1).max(200).default(20),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
});

const meetingListSelect = {
  id: true,
  title: true,
  roomName: true,
  status: true,
  startsAt: true,
  createdAt: true,
  waitingRoom: true,
  passwordHash: true,
  createdBy: { select: { id: true, name: true } },
  _count: {
    select: {
      participants: { where: { joinedAt: { not: null } } },
    },
  },
} as const;

function serializeMeeting<T extends { passwordHash: string | null }>(meeting: T) {
  const { passwordHash, ...rest } = meeting;
  return {
    ...rest,
    passwordRequired: Boolean(passwordHash),
  };
}

export async function GET(request: Request) {
  const context = await getCurrentSessionContext();
  if (!context?.activeMembership) {
    return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = listQuerySchema.safeParse({
    status: url.searchParams.get("status") ?? "ALL",
    take: url.searchParams.get("take") ?? "20",
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Filter meeting tidak valid." }, { status: 400 });
  }

  if (
    parsed.data.from &&
    parsed.data.to &&
    new Date(parsed.data.from).getTime() > new Date(parsed.data.to).getTime()
  ) {
    return NextResponse.json(
      { error: "Rentang tanggal tidak valid." },
      { status: 400 },
    );
  }

  const organizationId = context.activeMembership.organization.id;
  const dateFilter =
    parsed.data.from || parsed.data.to
      ? {
          OR: [
            {
              startsAt: {
                ...(parsed.data.from
                  ? { gte: new Date(parsed.data.from) }
                  : {}),
                ...(parsed.data.to ? { lte: new Date(parsed.data.to) } : {}),
              },
            },
            {
              startsAt: null,
              createdAt: {
                ...(parsed.data.from
                  ? { gte: new Date(parsed.data.from) }
                  : {}),
                ...(parsed.data.to ? { lte: new Date(parsed.data.to) } : {}),
              },
            },
          ],
        }
      : {};

  const meetings = await prisma.meeting.findMany({
    where: {
      organizationId,
      ...(parsed.data.status === "ALL" ? {} : { status: parsed.data.status }),
      ...dateFilter,
    },
    orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
    take: parsed.data.take,
    select: meetingListSelect,
  });

  return NextResponse.json(
    {
      meetings: meetings.map(serializeMeeting),
      currentRole: context.activeMembership.role,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  try {
    const context = await getCurrentSessionContext();
    if (!context?.activeMembership) {
      return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
    }

    const payload: unknown = await request.json();
    const result = createMeetingSchema.safeParse(payload);

    if (!result.success) {
      return NextResponse.json({ error: "Data meeting tidak valid." }, { status: 400 });
    }

    const organizationId =
      result.data.organizationId ?? context.activeMembership.organization.id;
    const membership = context.user.memberships.find(
      (item) => item.organization.id === organizationId,
    );

    if (!membership) {
      return NextResponse.json(
        { error: "Anda tidak memiliki akses ke organisasi tersebut." },
        { status: 403 },
      );
    }

    const meetingQuota = await assertCanCreateMeeting(organizationId);
    if (!meetingQuota.ok) {
      return NextResponse.json(
        { error: meetingQuota.error },
        { status: meetingQuota.status },
      );
    }

    const inviteEmails = parseInviteEmails(result.data.inviteEmails);
    const invalidEmail = inviteEmails.find(
      (email) => !z.string().email().safeParse(email).success,
    );
    if (invalidEmail) {
      return NextResponse.json(
        { error: `Email undangan tidak valid: ${invalidEmail}` },
        { status: 400 },
      );
    }

    const invitePhones = parseInvitePhones(result.data.invitePhones);
    const invalidPhone = invitePhones.find((phone) => !isValidInvitePhone(phone));
    if (invalidPhone) {
      return NextResponse.json(
        { error: `Nomor WhatsApp tidak valid: ${invalidPhone}` },
        { status: 400 },
      );
    }

    const startsAt = result.data.startsAt
      ? new Date(result.data.startsAt)
      : new Date();
    const isScheduled = isFutureStart(startsAt);
    const password = result.data.password?.trim();
    const passwordHash = password ? await hash(password, 12) : null;

    const meeting = await prisma.meeting.create({
      data: {
        organizationId: membership.organization.id,
        createdById: context.user.id,
        title: result.data.title || "Meeting instan",
        roomName: createRoomName(),
        passwordHash,
        waitingRoom: result.data.waitingRoom,
        status: isScheduled ? "SCHEDULED" : "ACTIVE",
        startsAt,
      },
      select: {
        id: true,
        roomName: true,
        title: true,
        status: true,
        startsAt: true,
        waitingRoom: true,
      },
    });

    const delivery = await deliverMeetingInvites({
      meeting: {
        ...meeting,
        passwordHash,
        organization: { name: membership.organization.name },
      },
      hostName: context.user.name,
      emails: inviteEmails,
      phones: invitePhones,
      requestOrigin: new URL(request.url).origin,
    });

    await writeAuditLog({
      organizationId: membership.organization.id,
      actorId: context.user.id,
      action: "meeting.created",
      targetType: "meeting",
      targetId: meeting.id,
      metadata: {
        title: meeting.title,
        roomName: meeting.roomName,
        status: meeting.status,
        inviteEmails,
        invitePhones,
        emailDelivery: delivery.emailDelivery,
        whatsappDelivery: delivery.whatsappDelivery,
      },
    });

    return NextResponse.json(
      {
        meeting: {
          ...meeting,
          passwordRequired: Boolean(passwordHash),
        },
        inviteUrl: delivery.invitePath,
        delivery: delivery.emailDelivery,
        whatsappDelivery: delivery.whatsappDelivery,
        invitedCount: inviteEmails.length + invitePhones.length,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Format data tidak valid." }, { status: 400 });
    }

    console.error("Meeting creation failed", error);
    return NextResponse.json(
      { error: "Meeting belum dapat dibuat. Silakan coba kembali." },
      { status: 500 },
    );
  }
}
