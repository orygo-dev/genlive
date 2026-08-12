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

/** Cloudflare R2 rejects AWS-style names like "Asia-Pacific" or "ap-southeast-1". */
export function normalizeEgressS3Region(
  region: string,
  endpoint?: string | null,
): string {
  const trimmed = region.trim();
  const endpointLower = (endpoint || "").toLowerCase();
  const isR2 = endpointLower.includes("r2.cloudflarestorage.com");
  if (!isR2) {
    return trimmed;
  }

  const allowed = new Set([
    "wnam",
    "enam",
    "weur",
    "eeur",
    "apac",
    "oc",
    "auto",
  ]);
  const lower = trimmed.toLowerCase();
  if (allowed.has(lower)) {
    return lower;
  }
  if (/asia|apac|singapore|jakarta|tokyo/i.test(trimmed)) {
    return "apac";
  }
  return "auto";
}

/** LiveKit docs: non-AWS S3 (R2/MinIO) must use force_path_style. */
export function resolveEgressForcePathStyle(
  endpoint: string | null | undefined,
  configured: boolean | null | undefined,
): boolean {
  const endpointLower = (endpoint || "").toLowerCase();
  if (
    endpointLower.includes("r2.cloudflarestorage.com") ||
    endpointLower.includes("minio") ||
    endpointLower.includes("localhost")
  ) {
    return true;
  }
  return Boolean(configured);
}

/** Prefer public R2/CDN URL for browser downloads (API endpoint is not public). */
export function resolveRecordingDownloadUrl(input: {
  downloadUrl?: string | null;
  filepath?: string | null;
  publicBaseUrl?: string | null;
}) {
  const base = input.publicBaseUrl?.trim().replace(/\/$/, "");
  const path = input.filepath?.trim().replace(/^\//, "");
  if (base && path) {
    return `${base}/${path}`;
  }

  const url = input.downloadUrl?.trim();
  if (!url) {
    return null;
  }
  if (url.includes("r2.cloudflarestorage.com")) {
    return null;
  }
  return url;
}
