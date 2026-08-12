import "server-only";

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getPlatformConfig } from "@/lib/platform-config";
import {
  normalizeEgressS3Region,
  resolveEgressForcePathStyle,
} from "@/lib/recording-helpers";

export { recordingAppDownloadPath } from "@/lib/recording-helpers";

export async function createRecordingS3Client() {
  const config = await getPlatformConfig();
  if (
    !config.livekitEgressS3AccessKey ||
    !config.livekitEgressS3Secret ||
    !config.livekitEgressS3Bucket ||
    !config.livekitEgressS3Region
  ) {
    throw new Error("Storage recording belum dikonfigurasi.");
  }

  return {
    client: new S3Client({
      region: normalizeEgressS3Region(
        config.livekitEgressS3Region,
        config.livekitEgressS3Endpoint,
      ),
      endpoint: config.livekitEgressS3Endpoint || undefined,
      forcePathStyle: resolveEgressForcePathStyle(
        config.livekitEgressS3Endpoint,
        config.livekitEgressS3ForcePathStyle,
      ),
      credentials: {
        accessKeyId: config.livekitEgressS3AccessKey,
        secretAccessKey: config.livekitEgressS3Secret,
      },
    }),
    bucket: config.livekitEgressS3Bucket,
  };
}

export async function createRecordingPresignedDownloadUrl(input: {
  filepath: string;
  expiresInSeconds?: number;
}) {
  const key = input.filepath.replace(/^\//, "");
  const { client, bucket } = await createRecordingS3Client();
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${key.split("/").pop() || "recording.mp4"}"`,
    ResponseContentType: "video/mp4",
  });
  return getSignedUrl(client, command, {
    expiresIn: input.expiresInSeconds ?? 60 * 15,
  });
}
