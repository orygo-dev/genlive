import "server-only";

import type { EgressInfo } from "livekit-server-sdk";
import { prisma } from "@/lib/db";
import {
  buildRecordingFilepath,
  extractEgressFile,
  mapEgressStatus,
  startRoomRecording,
  stopRoomRecording,
} from "@/lib/livekit-egress";
import { assertCanStartRecording } from "@/lib/billing";
import { writeAuditLog } from "@/lib/organization";

const OPEN_RECORDING_STATUSES = ["STARTING", "ACTIVE", "ENDING"] as const;

export async function getOpenRecording(meetingId: string) {
  return prisma.recording.findFirst({
    where: {
      meetingId,
      status: { in: [...OPEN_RECORDING_STATUSES] },
    },
    orderBy: { startedAt: "desc" },
  });
}

export async function startMeetingRecording(input: {
  meeting: {
    id: string;
    organizationId: string;
    roomName: string;
    status: string;
    title: string;
  };
  actorId: string;
}) {
  if (input.meeting.status !== "ACTIVE") {
    return {
      error: "Recording hanya dapat dimulai saat meeting aktif.",
      status: 409 as const,
    };
  }

  const open = await getOpenRecording(input.meeting.id);
  if (open) {
    return {
      error: "Meeting ini sudah memiliki recording yang berjalan.",
      status: 409 as const,
      recording: open,
    };
  }

  const recordingQuota = await assertCanStartRecording(
    input.meeting.organizationId,
  );
  if (!recordingQuota.ok) {
    return {
      error: recordingQuota.error,
      status: recordingQuota.status,
    };
  }

  const recordingId = crypto.randomUUID();
  const filepath = buildRecordingFilepath({
    organizationId: input.meeting.organizationId,
    meetingId: input.meeting.id,
    recordingId,
  });

  let egress: EgressInfo;
  try {
    egress = await startRoomRecording({
      roomName: input.meeting.roomName,
      filepath,
    });
  } catch (error) {
    console.error("Start egress failed", error);
    return {
      error:
        "Recording belum dapat dimulai. Pastikan Egress LiveKit aktif untuk project Anda.",
      status: 502 as const,
    };
  }

  if (!egress.egressId) {
    return {
      error: "LiveKit tidak mengembalikan egress ID.",
      status: 502 as const,
    };
  }

  const recording = await prisma.recording.create({
    data: {
      id: recordingId,
      meetingId: input.meeting.id,
      organizationId: input.meeting.organizationId,
      startedById: input.actorId,
      egressId: egress.egressId,
      status: mapEgressStatus(egress.status),
      filepath,
    },
    select: {
      id: true,
      status: true,
      egressId: true,
      filepath: true,
      downloadUrl: true,
      durationSeconds: true,
      startedAt: true,
      endedAt: true,
      errorMessage: true,
    },
  });

  await writeAuditLog({
    organizationId: input.meeting.organizationId,
    actorId: input.actorId,
    action: "recording.started",
    targetType: "recording",
    targetId: recording.id,
    metadata: {
      meetingId: input.meeting.id,
      roomName: input.meeting.roomName,
      egressId: recording.egressId,
    },
  });

  return { recording };
}

export async function stopMeetingRecording(input: {
  meeting: {
    id: string;
    organizationId: string;
    roomName: string;
    title: string;
  };
  actorId: string;
}) {
  const open = await getOpenRecording(input.meeting.id);
  if (!open) {
    return {
      error: "Tidak ada recording aktif untuk dihentikan.",
      status: 409 as const,
    };
  }

  try {
    await stopRoomRecording(open.egressId);
  } catch (error) {
    console.error("Stop egress failed", error);
    return {
      error: "Recording belum dapat dihentikan.",
      status: 502 as const,
    };
  }

  const recording = await prisma.recording.update({
    where: { id: open.id },
    data: { status: "ENDING" },
    select: {
      id: true,
      status: true,
      egressId: true,
      filepath: true,
      downloadUrl: true,
      durationSeconds: true,
      startedAt: true,
      endedAt: true,
      errorMessage: true,
    },
  });

  await writeAuditLog({
    organizationId: input.meeting.organizationId,
    actorId: input.actorId,
    action: "recording.stopped",
    targetType: "recording",
    targetId: recording.id,
    metadata: {
      meetingId: input.meeting.id,
      roomName: input.meeting.roomName,
      egressId: recording.egressId,
    },
  });

  return { recording };
}

export async function syncRecordingFromEgress(info: EgressInfo) {
  if (!info.egressId) {
    return null;
  }

  const existing = await prisma.recording.findUnique({
    where: { egressId: info.egressId },
    select: { id: true },
  });
  if (!existing) {
    return null;
  }

  const mapped = mapEgressStatus(info.status);
  const file = extractEgressFile(info);
  const ended =
    mapped === "COMPLETE" ||
    mapped === "FAILED" ||
    mapped === "ABORTED";

  return prisma.recording.update({
    where: { id: existing.id },
    data: {
      status: mapped,
      filepath: file.filepath ?? undefined,
      downloadUrl: file.downloadUrl ?? undefined,
      durationSeconds: file.durationSeconds ?? undefined,
      errorMessage: info.error?.slice(0, 500) || null,
      endedAt: ended ? new Date() : undefined,
    },
  });
}
