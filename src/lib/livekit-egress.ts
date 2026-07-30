import "server-only";

import {
  EgressClient,
  EncodedFileOutput,
  EncodedFileType,
  S3Upload,
} from "livekit-server-sdk";
import { getLiveKitEnvironment } from "@/lib/livekit";

export {
  buildRecordingFilepath,
  extractEgressFile,
  mapEgressStatus,
  recordingStatusLabel,
} from "@/lib/recording-helpers";

export function getLiveKitApiHost() {
  const configured = process.env.LIVEKIT_API_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  const { LIVEKIT_URL } = getLiveKitEnvironment();
  return LIVEKIT_URL.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
}

export function getEgressClient() {
  const environment = getLiveKitEnvironment();
  return new EgressClient(
    getLiveKitApiHost(),
    environment.LIVEKIT_API_KEY,
    environment.LIVEKIT_API_SECRET,
  );
}

export function isEgressS3Configured() {
  return Boolean(
    process.env.LIVEKIT_EGRESS_S3_ACCESS_KEY?.trim() &&
      process.env.LIVEKIT_EGRESS_S3_SECRET?.trim() &&
      process.env.LIVEKIT_EGRESS_S3_BUCKET?.trim() &&
      process.env.LIVEKIT_EGRESS_S3_REGION?.trim(),
  );
}

export function buildEncodedFileOutput(filepath: string) {
  if (isEgressS3Configured()) {
    return new EncodedFileOutput({
      fileType: EncodedFileType.MP4,
      filepath,
      output: {
        case: "s3",
        value: new S3Upload({
          accessKey: process.env.LIVEKIT_EGRESS_S3_ACCESS_KEY!.trim(),
          secret: process.env.LIVEKIT_EGRESS_S3_SECRET!.trim(),
          bucket: process.env.LIVEKIT_EGRESS_S3_BUCKET!.trim(),
          region: process.env.LIVEKIT_EGRESS_S3_REGION!.trim(),
          endpoint: process.env.LIVEKIT_EGRESS_S3_ENDPOINT?.trim() || undefined,
          forcePathStyle:
            process.env.LIVEKIT_EGRESS_S3_FORCE_PATH_STYLE === "true",
        }),
      },
    });
  }

  return new EncodedFileOutput({
    fileType: EncodedFileType.MP4,
    filepath,
  });
}

export async function startRoomRecording(input: {
  roomName: string;
  filepath: string;
}) {
  const client = getEgressClient();
  return client.startRoomCompositeEgress(
    input.roomName,
    { file: buildEncodedFileOutput(input.filepath) },
    { layout: "grid" },
  );
}

export async function stopRoomRecording(egressId: string) {
  const client = getEgressClient();
  return client.stopEgress(egressId);
}
