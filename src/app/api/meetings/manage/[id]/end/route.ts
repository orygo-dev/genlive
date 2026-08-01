import { NextResponse } from "next/server";
import { getCurrentSessionContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManageMeeting } from "@/lib/meeting-access";
import { writeAuditLog } from "@/lib/organization";
import { getRoomServiceClient } from "@/lib/livekit-room-admin";

export const runtime = "nodejs";

type EndRouteProps = {
  params: Promise<{ id: string }>;
};

export async function POST(_: Request, { params }: EndRouteProps) {
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
    if (meeting.status === "ENDED" || meeting.status === "CANCELLED") {
      return NextResponse.json(
        { error: "Meeting sudah berakhir." },
        { status: 409 },
      );
    }

    const updated = await prisma.meeting.update({
      where: { id: meeting.id },
      data: {
        status: "ENDED",
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

    try {
      const client = await getRoomServiceClient();
      const participants = await client.listParticipants(meeting.roomName);
      await Promise.all(
        participants.map(async (participant) => {
          if (!participant.identity) return;
          await client.removeParticipant(meeting.roomName, participant.identity);
        }),
      );
    } catch {
      // Room may already be empty.
    }

    await writeAuditLog({
      organizationId: meeting.organizationId,
      actorId: context.user.id,
      action: "meeting.ended",
      targetType: "meeting",
      targetId: meeting.id,
      metadata: { title: meeting.title, roomName: meeting.roomName },
    });

    return NextResponse.json({ meeting: updated });
  } catch (error) {
    console.error("End meeting failed", error);
    return NextResponse.json(
      { error: "Meeting belum dapat diakhiri." },
      { status: 500 },
    );
  }
}
