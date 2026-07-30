import { NextResponse } from "next/server";
import { getCurrentSessionContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManageMeeting, canStartMeeting } from "@/lib/meeting-access";
import { writeAuditLog } from "@/lib/organization";

export const runtime = "nodejs";

type StartRouteProps = {
  params: Promise<{ id: string }>;
};

export async function POST(_: Request, { params }: StartRouteProps) {
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

    if (!canStartMeeting(meeting.status)) {
      return NextResponse.json(
        { error: "Hanya meeting terjadwal yang dapat dimulai." },
        { status: 409 },
      );
    }

    const updated = await prisma.meeting.update({
      where: { id: meeting.id },
      data: {
        status: "ACTIVE",
      },
      select: {
        id: true,
        title: true,
        roomName: true,
        status: true,
        startsAt: true,
      },
    });

    await writeAuditLog({
      organizationId: meeting.organizationId,
      actorId: context.user.id,
      action: "meeting.started",
      targetType: "meeting",
      targetId: meeting.id,
      metadata: {
        title: meeting.title,
        roomName: meeting.roomName,
      },
    });

    return NextResponse.json({ meeting: updated });
  } catch (error) {
    console.error("Start meeting failed", error);
    return NextResponse.json(
      { error: "Meeting belum dapat dimulai." },
      { status: 500 },
    );
  }
}
