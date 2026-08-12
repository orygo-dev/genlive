import "server-only";

import {
  EgressClient,
  EncodedFileOutput,
  EncodedFileType,
  S3Upload,
} from "livekit-server-sdk";
import { getLiveKitEnvironment } from "@/lib/livekit";
import { getPlatformConfig } from "@/lib/platform-config";
import { normalizeEgressS3Region, resolveEgressForcePathStyle } from "@/lib/recording-helpers";

export {
  buildRecordingFilepath,
  extractEgressFile,
  mapEgressStatus,
  normalizeEgressS3Region,
  recordingStatusLabel,
  resolveEgressForcePathStyle,
} from "@/lib/recording-helpers";

export async function getLiveKitApiHost(serverId?: string | null) {
  const environment = await getLiveKitEnvironment(serverId);
  return environment.LIVEKIT_API_URL.replace(/\/$/, "");
}

export async function getEgressClient() {
  const environment = await getLiveKitEnvironment();
  return new EgressClient(
    environment.LIVEKIT_API_URL,
    environment.LIVEKIT_API_KEY,
    environment.LIVEKIT_API_SECRET,
  );
}

export async function isEgressS3Configured() {
  const config = await getPlatformConfig();
  return Boolean(
    config.livekitEgressS3AccessKey &&
      config.livekitEgressS3Secret &&
      config.livekitEgressS3Bucket &&
      config.livekitEgressS3Region,
  );
}

export async function buildEncodedFileOutput(filepath: string) {
  const config = await getPlatformConfig();
  if (!(await isEgressS3Configured())) {
    throw new Error(
      "LIVEKIT_EGRESS_S3 belum lengkap (access key, secret, bucket, region).",
    );
  }
  return new EncodedFileOutput({
    fileType: EncodedFileType.MP4,
    filepath,
    output: {
      case: "s3",
      value: new S3Upload({
        accessKey: config.livekitEgressS3AccessKey!,
        secret: config.livekitEgressS3Secret!,
        bucket: config.livekitEgressS3Bucket!,
        region: normalizeEgressS3Region(
          config.livekitEgressS3Region!,
          config.livekitEgressS3Endpoint,
        ),
        endpoint: config.livekitEgressS3Endpoint || undefined,
        forcePathStyle: resolveEgressForcePathStyle(
          config.livekitEgressS3Endpoint,
          config.livekitEgressS3ForcePathStyle,
        ),
      }),
    },
  });
}

export async function startRoomRecording(input: {
  roomName: string;
  filepath: string;
}) {
  const client = await getEgressClient();
  return client.startRoomCompositeEgress(
    input.roomName,
    { file: await buildEncodedFileOutput(input.filepath) },
    { layout: "grid" },
  );
}

export async function stopRoomRecording(egressId: string) {
  const client = await getEgressClient();
  return client.stopEgress(egressId);
}

export async function getEgressInfo(egressId: string) {
  const client = await getEgressClient();
  const items = await client.listEgress({ egressId });
  return items[0] ?? null;
}
