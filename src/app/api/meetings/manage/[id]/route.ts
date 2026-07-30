import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { getCurrentSessionContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  canEditMeetingFields,
  canManageMeeting,
  canViewMeeting,
} from "@/lib/meeting-access";
import { writeAuditLog } from "@/lib/organization";

export const runtime = "nodejs";

type MeetingRouteProps = {
  params: Promise<{ id: string }>;
};

const updateMeetingSchema = z
  .object({
    title: z.string().trim().min(2).max(120).optional(),
    startsAt: z.iso.datetime().optional(),
    waitingRoom: z.boolean().optional(),
    password: z.string().max(72).optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.startsAt !== undefined ||
      value.waitingRoom !== undefined ||
      value.password !== undefined,
    { message: "Tidak ada perubahan untuk disimpan." },
  );

const meetingDetailSelect = {
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
    orderBy: { joinedAt: "desc" as const },
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
};

function serializeDetail<T extends { passwordHash: string | null }>(meeting: T) {
  const { passwordHash, ...rest } = meeting;
  return {
    ...rest,
    passwordRequired: Boolean(passwordHash),
  };
}

export async function GET(_: Request, { params }: MeetingRouteProps) {
  const { id } = await params;
  const context = await getCurrentSessionContext();
  if (!context) {
    return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id },
    select: meetingDetailSelect,
  });

  if (!meeting) {
    return NextResponse.json({ error: "Meeting tidak ditemukan." }, { status: 404 });
  }

  if (!canViewMeeting(context.user, meeting)) {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  return NextResponse.json(
    {
      meeting: serializeDetail(meeting),
      canManage: canManageMeeting(context.user, meeting),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(request: Request, { params }: MeetingRouteProps) {
  try {
    const { id } = await params;
    const context = await getCurrentSessionContext();
    if (!context) {
      return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
    }

    const existing = await prisma.meeting.findUnique({
      where: { id },
      select: {
        id: true,
        organizationId: true,
        createdById: true,
        status: true,
        title: true,
        startsAt: true,
        waitingRoom: true,
        passwordHash: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Meeting tidak ditemukan." }, { status: 404 });
    }

    if (!canManageMeeting(context.user, existing)) {
      return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
    }

    if (!canEditMeetingFields(existing.status)) {
      return NextResponse.json(
        { error: "Meeting yang sudah selesai atau dibatalkan tidak dapat diubah." },
        { status: 409 },
      );
    }

    const payload: unknown = await request.json();
    const result = updateMeetingSchema.safeParse(payload);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message ?? "Data meeting tidak valid." },
        { status: 400 },
      );
    }

    if (result.data.startsAt !== undefined && existing.status !== "SCHEDULED") {
      return NextResponse.json(
        { error: "Jadwal hanya dapat diubah untuk meeting terjadwal." },
        { status: 409 },
      );
    }

    const data: {
      title?: string;
      startsAt?: Date;
      waitingRoom?: boolean;
      passwordHash?: string | null;
    } = {};

    if (result.data.title !== undefined) {
      data.title = result.data.title;
    }
    if (result.data.waitingRoom !== undefined) {
      data.waitingRoom = result.data.waitingRoom;
    }
    if (result.data.startsAt !== undefined) {
      data.startsAt = new Date(result.data.startsAt);
    }
    if (result.data.password !== undefined) {
      const nextPassword = result.data.password.trim();
      data.passwordHash = nextPassword ? await hash(nextPassword, 12) : null;
    }

    const updated = await prisma.meeting.update({
      where: { id: existing.id },
      data,
      select: meetingDetailSelect,
    });

    await writeAuditLog({
      organizationId: existing.organizationId,
      actorId: context.user.id,
      action: "meeting.updated",
      targetType: "meeting",
      targetId: existing.id,
      metadata: {
        title: updated.title,
        previousTitle: existing.title,
        waitingRoom: updated.waitingRoom,
        passwordChanged: result.data.password !== undefined,
        startsAt: updated.startsAt?.toISOString() ?? null,
      },
    });

    return NextResponse.json({
      meeting: serializeDetail(updated),
      canManage: true,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Format data tidak valid." }, { status: 400 });
    }

    console.error("Update meeting failed", error);
    return NextResponse.json(
      { error: "Meeting belum dapat diperbarui." },
      { status: 500 },
    );
  }
}
