import { NextResponse } from "next/server";
import { getCurrentSessionContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canViewMeeting } from "@/lib/meeting-access";
import { createRecordingPresignedDownloadUrl } from "@/lib/recording-download";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DownloadRouteProps = {
  params: Promise<{ id: string; recordingId: string }>;
};

export async function GET(_: Request, { params }: DownloadRouteProps) {
  try {
    const { id: meetingId, recordingId } = await params;
    const context = await getCurrentSessionContext();
    if (!context) {
      return NextResponse.json(
        { error: "Silakan masuk terlebih dahulu." },
        { status: 401 },
      );
    }

    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: {
        id: true,
        organizationId: true,
        createdById: true,
      },
    });
    if (!meeting) {
      return NextResponse.json({ error: "Meeting tidak ditemukan." }, { status: 404 });
    }
    if (!canViewMeeting(context.user, meeting)) {
      return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
    }

    const recording = await prisma.recording.findFirst({
      where: {
        id: recordingId,
        meetingId: meeting.id,
        organizationId: meeting.organizationId,
      },
      select: {
        id: true,
        status: true,
        filepath: true,
      },
    });
    if (!recording) {
      return NextResponse.json(
        { error: "Recording tidak ditemukan." },
        { status: 404 },
      );
    }
    if (recording.status !== "COMPLETE") {
      return NextResponse.json(
        { error: "Recording belum siap diunduh." },
        { status: 409 },
      );
    }
    if (!recording.filepath) {
      return NextResponse.json(
        { error: "File recording tidak tersedia di storage." },
        { status: 404 },
      );
    }

    const url = await createRecordingPresignedDownloadUrl({
      filepath: recording.filepath,
    });
    return NextResponse.redirect(url, 302);
  } catch (error) {
    console.error("Recording download failed", error);
    const message =
      error instanceof Error ? error.message : "Unduhan recording gagal.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
