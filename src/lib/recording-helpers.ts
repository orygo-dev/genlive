type EgressFileLike = {
  filename?: string;
  location?: string;
  duration?: bigint | number;
};

export function buildRecordingFilepath(input: {
  organizationId: string;
  meetingId: string;
  recordingId: string;
}) {
  return `recordings/${input.organizationId}/${input.meetingId}/${input.recordingId}.mp4`;
}

export function mapEgressStatus(
  status: number,
): "STARTING" | "ACTIVE" | "ENDING" | "COMPLETE" | "FAILED" | "ABORTED" {
  switch (status) {
    case 1: // EGRESS_ACTIVE
      return "ACTIVE";
    case 2: // EGRESS_ENDING
      return "ENDING";
    case 3: // EGRESS_COMPLETE
      return "COMPLETE";
    case 4: // EGRESS_FAILED
    case 6: // EGRESS_LIMIT_REACHED
      return "FAILED";
    case 5: // EGRESS_ABORTED
      return "ABORTED";
    default:
      return "STARTING";
  }
}

export function extractEgressFile(info: { fileResults?: EgressFileLike[] }) {
  const file = info.fileResults?.[0];
  if (!file) {
    return {
      filepath: null as string | null,
      downloadUrl: null as string | null,
      durationSeconds: null as number | null,
    };
  }

  const durationNs = Number(file.duration ?? 0);
  return {
    filepath: file.filename || null,
    downloadUrl: file.location || null,
    durationSeconds:
      durationNs > 0 ? Math.max(1, Math.round(durationNs / 1_000_000_000)) : null,
  };
}

export function recordingStatusLabel(
  status: "STARTING" | "ACTIVE" | "ENDING" | "COMPLETE" | "FAILED" | "ABORTED",
) {
  switch (status) {
    case "STARTING":
      return "Menyiapkan";
    case "ACTIVE":
      return "Merekam";
    case "ENDING":
      return "Mengakhiri";
    case "COMPLETE":
      return "Selesai";
    case "FAILED":
      return "Gagal";
    default:
      return "Dibatalkan";
  }
}
