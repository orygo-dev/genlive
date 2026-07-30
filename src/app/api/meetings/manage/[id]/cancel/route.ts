import { NextResponse } from "next/server";
import { getCurrentSessionContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canCancelMeeting, canManageMeeting } from "@/lib/meeting-access";
import { writeAuditLog } from "@/lib/organization";

export const runtime = "nodejs";

type CancelRouteProps = {
  params: Promise<{ id: string }>;
};

export async function POST(_: Request, { params }: CancelRouteProps) {
  try {
    const { id } = await params;
    const context = await getCurrentSessionContext();
    if (!context) {
      return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
    }

    const meeting = await prisma.meeting.findUnique({
      where: { id },
      select: {
        id: true,
        organizationId: true,
        createdById: true,
        status: true,
        title: true,
        roomName: true,
      },
    });

    if (!meeting) {
      return NextResponse.json({ error: "Meeting tidak ditemukan." }, { status: 404 });
    }

    if (!canManageMeeting(context.user, meeting)) {
      return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
    }

    if (!canCancelMeeting(meeting.status)) {
      return NextResponse.json(
        { error: "Meeting ini sudah tidak dapat dibatalkan." },
        { status: 409 },
      );
    }

    const updated = await prisma.meeting.update({
      where: { id: meeting.id },
      data: {
        status: "CANCELLED",
        endedAt: new Date(),
      },
      select: {
        id: true,
        title: true,
        roomName: true,
        status: true,
        endedAt: true,
      },
    });

    await writeAuditLog({
      organizationId: meeting.organizationId,
      actorId: context.user.id,
      action: "meeting.cancelled",
      targetType: "meeting",
      targetId: meeting.id,
      metadata: {
        title: meeting.title,
        roomName: meeting.roomName,
        previousStatus: meeting.status,
      },
    });

    return NextResponse.json({ meeting: updated });
  } catch (error) {
    console.error("Cancel meeting failed", error);
    return NextResponse.json(
      { error: "Meeting belum dapat dibatalkan." },
      { status: 500 },
    );
  }
}
