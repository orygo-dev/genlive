import { NextResponse } from "next/server";
import { getCurrentSessionContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManageMeeting, canViewMeeting } from "@/lib/meeting-access";
import { getPlatformConfig } from "@/lib/platform-config";
import {
  reconcileOpenRecording,
  startMeetingRecording,
  stopMeetingRecording,
} from "@/lib/recording";
import { resolveRecordingDownloadUrl } from "@/lib/recording-helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

type RecordingRouteProps = {
  params: Promise<{ id: string }>;
};

async function loadManagedMeeting(id: string) {
  return prisma.meeting.findUnique({
    where: { id },
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

export async function GET(_: Request, { params }: RecordingRouteProps) {
  const { id } = await params;
  const context = await getCurrentSessionContext();
  if (!context) {
    return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  }

  const meeting = await loadManagedMeeting(id);
  if (!meeting) {
    return NextResponse.json({ error: "Meeting tidak ditemukan." }, { status: 404 });
  }
  if (!canViewMeeting(context.user, meeting)) {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  const config = await getPlatformConfig();
  const [recordings, active] = await Promise.all([
    prisma.recording.findMany({
      where: { meetingId: meeting.id },
      orderBy: { startedAt: "desc" },
      take: 30,
      select: {
        id: true,
        status: true,
        filepath: true,
        downloadUrl: true,
        durationSeconds: true,
        startedAt: true,
        endedAt: true,
        errorMessage: true,
        startedBy: { select: { name: true } },
      },
    }),
    reconcileOpenRecording(meeting.id),
  ]);

  return NextResponse.json(
    {
      recordings: recordings.map((recording) => ({
        ...recording,
        downloadUrl: resolveRecordingDownloadUrl({
          downloadUrl: recording.downloadUrl,
          filepath: recording.filepath,
          publicBaseUrl: config.livekitEgressS3PublicBaseUrl,
        }),
      })),
      publicBaseConfigured: Boolean(config.livekitEgressS3PublicBaseUrl),
      activeRecording: active
        ? {
            id: active.id,
            status: active.status,
            startedAt: active.startedAt,
          }
        : null,
      canManage: canManageMeeting(context.user, meeting),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request, { params }: RecordingRouteProps) {
  try {
    const { id } = await params;
    const context = await getCurrentSessionContext();
    if (!context) {
      return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
    }

    const meeting = await loadManagedMeeting(id);
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
    console.error("Recording action failed", error);
    return NextResponse.json(
      { error: "Recording belum dapat diproses." },
      { status: 500 },
    );
  }
}
