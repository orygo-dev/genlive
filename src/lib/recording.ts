import "server-only";

import type { EgressInfo } from "livekit-server-sdk";
import { prisma } from "@/lib/db";
import {
  buildRecordingFilepath,
  extractEgressFile,
  isEgressS3Configured,
  mapEgressStatus,
  startRoomRecording,
  stopRoomRecording,
} from "@/lib/livekit-egress";
import { assertCanStartRecording } from "@/lib/billing";
import { writeAuditLog } from "@/lib/organization";

const OPEN_RECORDING_STATUSES = ["STARTING", "ACTIVE", "ENDING"] as const;

function sanitizeEgressError(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Egress LiveKit gagal.";
  return raw.replace(/\s+/g, " ").trim().slice(0, 400);
}

export async function getOpenRecording(meetingId: string) {
  return prisma.recording.findFirst({
    where: {
      meetingId,
      status: { in: [...OPEN_RECORDING_STATUSES] },
    },
    orderBy: { startedAt: "desc" },
  });
}

const recordingSelect = {
  id: true,
  status: true,
  egressId: true,
  filepath: true,
  downloadUrl: true,
  durationSeconds: true,
  startedAt: true,
  endedAt: true,
  errorMessage: true,
} as const;

export async function startMeetingRecording(input: {
  meeting: {
    id: string;
    organizationId: string;
    roomName: string;
    status: string;
    title: string;
  };
  actorId: string;
  consentAcknowledged: boolean;
}) {
  if (!input.consentAcknowledged) {
    return {
      error:
        "Konfirmasi persetujuan recording wajib sebelum memulai rekaman.",
      status: 400 as const,
    };
  }

  // Host may join a SCHEDULED meeting without an explicit "Start" click.
  if (input.meeting.status === "SCHEDULED") {
    await prisma.meeting.update({
      where: { id: input.meeting.id },
      data: { status: "ACTIVE" },
    });
    input.meeting.status = "ACTIVE";
  }

  if (input.meeting.status !== "ACTIVE") {
    return {
      error: "Recording hanya dapat dimulai saat meeting aktif.",
      status: 409 as const,
    };
  }

  const open = await getOpenRecording(input.meeting.id);
  if (open) {
    // Idempotent: do not start a second egress for the same room.
    return { recording: open, reused: true as const };
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

  if (!(await isEgressS3Configured())) {
    return {
      error:
        "Storage Egress belum dikonfigurasi. Isi LIVEKIT_EGRESS_S3_* (Access Key, Secret, Bucket, Region) di Super Admin → Integrasi atau environment server. LiveKit Cloud membutuhkan S3/compatible storage untuk menyimpan MP4.",
      status: 503 as const,
    };
  }

  const recordingId = crypto.randomUUID();
  const pendingEgressId = `pending-${recordingId}`;
  const filepath = buildRecordingFilepath({
    organizationId: input.meeting.organizationId,
    meetingId: input.meeting.id,
    recordingId,
  });

  // Reserve an open row before calling LiveKit so concurrent starts collide here.
  let reserved;
  try {
    reserved = await prisma.recording.create({
      data: {
        id: recordingId,
        meetingId: input.meeting.id,
        organizationId: input.meeting.organizationId,
        startedById: input.actorId,
        consentAcknowledgedAt: new Date(),
        consentByUserId: input.actorId,
        egressId: pendingEgressId,
        status: "STARTING",
        filepath,
      },
      select: recordingSelect,
    });
  } catch {
    const raced = await getOpenRecording(input.meeting.id);
    if (raced) {
      return { recording: raced, reused: true as const };
    }
    return {
      error: "Recording belum dapat dipesan di database.",
      status: 500 as const,
    };
  }

  let egress: EgressInfo;
  try {
    egress = await startRoomRecording({
      roomName: input.meeting.roomName,
      filepath,
    });
  } catch (error) {
    const message = sanitizeEgressError(error);
    console.error("Start egress failed", error);
    await prisma.recording.update({
      where: { id: reserved.id },
      data: {
        status: "FAILED",
        errorMessage: message.slice(0, 500),
        endedAt: new Date(),
      },
    });
    return {
      error: `Recording gagal dimulai di LiveKit: ${message}`,
      status: 502 as const,
    };
  }

  if (!egress.egressId) {
    await prisma.recording.update({
      where: { id: reserved.id },
      data: {
        status: "FAILED",
        errorMessage: "LiveKit tidak mengembalikan egress ID.",
        endedAt: new Date(),
      },
    });
    return {
      error: "LiveKit tidak mengembalikan egress ID.",
      status: 502 as const,
    };
  }

  // LiveKit often returns EGRESS_STARTING (0) immediately after accept.
  // Treat accepted egress as ACTIVE so the host UI is stoppable and not stuck.
  const mapped = mapEgressStatus(egress.status);
  const nextStatus =
    mapped === "STARTING" || mapped === "ACTIVE" ? "ACTIVE" : mapped;

  const recording = await prisma.recording.update({
    where: { id: reserved.id },
    data: {
      egressId: egress.egressId,
      status: nextStatus,
    },
    select: recordingSelect,
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

  return { recording, reused: false as const };
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

  if (open.egressId.startsWith("pending-")) {
    const recording = await prisma.recording.update({
      where: { id: open.id },
      data: {
        status: "ABORTED",
        errorMessage: "Recording dibatalkan sebelum egress LiveKit siap.",
        endedAt: new Date(),
      },
      select: recordingSelect,
    });
    return { recording };
  }

  try {
    await stopRoomRecording(open.egressId);
  } catch (error) {
    const message = sanitizeEgressError(error);
    console.error("Stop egress failed", error);
    return {
      error: `Recording belum dapat dihentikan: ${message}`,
      status: 502 as const,
    };
  }

  const recording = await prisma.recording.update({
    where: { id: open.id },
    data: { status: "ENDING" },
    select: recordingSelect,
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
