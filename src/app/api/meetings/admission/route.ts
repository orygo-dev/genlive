import { NextResponse } from "next/server";
import { z } from "zod";
import { hashAdmissionToken } from "@/lib/admission";
import { prisma } from "@/lib/db";
import { createParticipantToken } from "@/lib/livekit-token";
import { getRoomLockState } from "@/lib/livekit-room-admin";

export const runtime = "nodejs";
const ADMISSION_RETRY_WINDOW_MS = 2 * 60 * 1000;

const admissionRequestSchema = z.object({
  requestId: z.uuid(),
  token: z.string().min(20).max(100),
});

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Format data tidak valid." }, { status: 400 });
  }
  const result = admissionRequestSchema.safeParse(payload);

  if (!result.success) {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }

  const participant = await prisma.meetingParticipant.findFirst({
    where: {
      id: result.data.requestId,
      admissionTokenHash: hashAdmissionToken(result.data.token),
    },
    select: {
      id: true,
      admissionStatus: true,
      livekitIdentity: true,
      displayName: true,
      role: true,
      admissionExpiresAt: true,
      admissionConsumedAt: true,
      meeting: {
        select: { roomName: true, status: true },
      },
    },
  });

  if (!participant) {
    return NextResponse.json({ error: "Permintaan tidak ditemukan." }, { status: 404 });
  }

  if (
    participant.admissionConsumedAt &&
    Date.now() - participant.admissionConsumedAt.getTime() >
      ADMISSION_RETRY_WINDOW_MS
  ) {
    return NextResponse.json(
      { error: "Token admission sudah digunakan." },
      { status: 410 },
    );
  }

  if (
    !participant.admissionConsumedAt &&
    (!participant.admissionExpiresAt ||
      participant.admissionExpiresAt.getTime() <= Date.now())
  ) {
    if (participant.admissionStatus === "WAITING") {
      await prisma.meetingParticipant.update({
        where: { id: participant.id },
        data: { admissionStatus: "REJECTED" },
      });
    }
    return NextResponse.json({ error: "Permintaan sudah kedaluwarsa." }, { status: 410 });
  }

  if (participant.admissionStatus === "WAITING") {
    return NextResponse.json(
      { status: "WAITING" },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  if (participant.admissionStatus === "REJECTED") {
    return NextResponse.json(
      { status: "REJECTED" },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  if (
    participant.meeting.status === "ENDED" ||
    participant.meeting.status === "CANCELLED"
  ) {
    return NextResponse.json(
      { error: "Meeting sudah berakhir." },
      { status: 410 },
    );
  }

  if (await getRoomLockState(participant.meeting.roomName)) {
    return NextResponse.json(
      { error: "Meeting sedang dikunci oleh host." },
      { status: 403 },
    );
  }

  const connection = await createParticipantToken({
    identity: participant.livekitIdentity,
    name: participant.displayName,
    role: participant.role,
    roomName: participant.meeting.roomName,
  });

  if (!participant.admissionConsumedAt) {
    await prisma.meetingParticipant.update({
      where: { id: participant.id },
      data: { admissionConsumedAt: new Date() },
    });
  }

  return NextResponse.json(
    { status: "ADMITTED", ...connection },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function DELETE(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Format data tidak valid." }, { status: 400 });
  }
  const result = admissionRequestSchema.safeParse(payload);

  if (!result.success) {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }

  const deletion = await prisma.meetingParticipant.deleteMany({
    where: {
      id: result.data.requestId,
      admissionTokenHash: hashAdmissionToken(result.data.token),
      admissionStatus: "WAITING",
    },
  });

  if (deletion.count === 0) {
    const participant = await prisma.meetingParticipant.findFirst({
      where: {
        id: result.data.requestId,
        admissionTokenHash: hashAdmissionToken(result.data.token),
      },
      select: { admissionStatus: true },
    });
    return NextResponse.json(
      {
        error: "Permintaan sudah diproses.",
        status: participant?.admissionStatus ?? "NOT_FOUND",
      },
      { status: 409 },
    );
  }

  return NextResponse.json({ success: true });
}
