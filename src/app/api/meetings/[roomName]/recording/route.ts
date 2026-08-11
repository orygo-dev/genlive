import { NextResponse } from "next/server";
import { getCurrentSessionContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManageMeeting, canViewMeeting } from "@/lib/meeting-access";
import { isEgressS3Configured } from "@/lib/livekit-egress";
import {
  getOpenRecording,
  startMeetingRecording,
  stopMeetingRecording,
} from "@/lib/recording";

export const runtime = "nodejs";
export const maxDuration = 60;

type RoomRecordingRouteProps = {
  params: Promise<{ roomName: string }>;
};

async function loadMeetingByRoom(roomName: string) {
  return prisma.meeting.findUnique({
    where: { roomName },
    select: {
      id: true,
      organizationId: true,
      createdById: true,
      roomName: true,
      status: true,
      title: true,
    },
  });
}

export async function GET(_: Request, { params }: RoomRecordingRouteProps) {
  const { roomName } = await params;
  const context = await getCurrentSessionContext();
  if (!context) {
    return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  }

  const meeting = await loadMeetingByRoom(roomName);
  if (!meeting) {
    return NextResponse.json({ error: "Meeting tidak ditemukan." }, { status: 404 });
  }
  if (!canViewMeeting(context.user, meeting)) {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  const active = await getOpenRecording(meeting.id);
  const egressConfigured = await isEgressS3Configured();
  const egressId =
    active?.egressId && !active.egressId.startsWith("pending-")
      ? active.egressId
      : undefined;
  return NextResponse.json(
    {
      meetingId: meeting.id,
      activeRecording: active
        ? {
            id: active.id,
            status: active.status,
            startedAt: active.startedAt,
            egressId,
          }
        : null,
      canManage: canManageMeeting(context.user, meeting),
      egressConfigured,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request, { params }: RoomRecordingRouteProps) {
  try {
    const { roomName } = await params;
    const context = await getCurrentSessionContext();
    if (!context) {
      return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
    }

    const meeting = await loadMeetingByRoom(roomName);
    if (!meeting) {
      return NextResponse.json({ error: "Meeting tidak ditemukan." }, { status: 404 });
    }
    if (!canManageMeeting(context.user, meeting)) {
      return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
    }

    const url = new URL(request.url);
    const action = url.searchParams.get("action") ?? "start";

    if (action === "stop") {
      const result = await stopMeetingRecording({
        meeting,
        actorId: context.user.id,
      });
      if ("error" in result && result.error) {
        return NextResponse.json(
          { error: result.error },
          { status: result.status ?? 400 },
        );
      }
      return NextResponse.json({ recording: result.recording });
    }

    let consentAcknowledged = false;
    try {
      const body = (await request.json()) as { consentAcknowledged?: boolean };
      consentAcknowledged = body.consentAcknowledged === true;
    } catch {
      consentAcknowledged = false;
    }

    const result = await startMeetingRecording({
      meeting,
      actorId: context.user.id,
      consentAcknowledged,
    });
    if ("error" in result && result.error) {
      return NextResponse.json(
        { error: result.error, recording: result.recording },
        { status: result.status ?? 400 },
      );
    }
    const reused = "reused" in result && result.reused === true;
    return NextResponse.json(
      { recording: result.recording, reused },
      { status: reused ? 200 : 201 },
    );
  } catch (error) {
    console.error("Room recording action failed", error);
    return NextResponse.json(
      { error: "Recording belum dapat diproses." },
      { status: 500 },
    );
  }
}
