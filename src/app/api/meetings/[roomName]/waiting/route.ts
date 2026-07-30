import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

type WaitingRouteProps = {
  params: Promise<{ roomName: string }>;
};

const decisionSchema = z.object({
  participantId: z.uuid(),
  decision: z.enum(["ADMITTED", "REJECTED"]),
});

async function getModeratedMeeting(roomName: string) {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  const meeting = await prisma.meeting.findUnique({
    where: { roomName },
    select: { id: true, createdById: true, organizationId: true },
  });
  if (!meeting) {
    return null;
  }

  const membership = user.memberships.find(
    (item) => item.organization.id === meeting.organizationId,
  );
  const canModerate =
    user.id === meeting.createdById ||
    membership?.role === "OWNER" ||
    membership?.role === "ADMIN";

  return canModerate ? meeting : null;
}

export async function GET(_: Request, { params }: WaitingRouteProps) {
  const { roomName } = await params;
  const meeting = await getModeratedMeeting(roomName);

  if (!meeting) {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  const now = new Date();
  await prisma.meetingParticipant.updateMany({
    where: {
      meetingId: meeting.id,
      admissionStatus: "WAITING",
      admissionExpiresAt: { lte: now },
    },
    data: { admissionStatus: "REJECTED" },
  });

  const participants = await prisma.meetingParticipant.findMany({
    where: {
      meetingId: meeting.id,
      admissionStatus: "WAITING",
      admissionExpiresAt: { gt: now },
    },
    orderBy: { requestedAt: "asc" },
    take: 50,
    select: { id: true, displayName: true, requestedAt: true },
  });

  return NextResponse.json(
    { participants },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request, { params }: WaitingRouteProps) {
  const { roomName } = await params;
  const meeting = await getModeratedMeeting(roomName);

  if (!meeting) {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Format data tidak valid." }, { status: 400 });
  }
  const result = decisionSchema.safeParse(payload);
  if (!result.success) {
    return NextResponse.json({ error: "Keputusan tidak valid." }, { status: 400 });
  }

  const update = await prisma.meetingParticipant.updateMany({
    where: {
      id: result.data.participantId,
      meetingId: meeting.id,
      admissionStatus: "WAITING",
      admissionExpiresAt: { gt: new Date() },
    },
    data: { admissionStatus: result.data.decision },
  });

  if (update.count === 0) {
    return NextResponse.json(
      { error: "Permintaan sudah diproses atau tidak ditemukan." },
      { status: 409 },
    );
  }

  return NextResponse.json({ success: true });
}
