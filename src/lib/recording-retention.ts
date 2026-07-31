import "server-only";

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

function isRemoteDownloadUrl(url: string | null | undefined) {
  if (!url) {
    return false;
  }
  return url.startsWith("http://") || url.startsWith("https://");
}

export async function processRecordingRetention(now = new Date()) {
  const organizations = await prisma.organization.findMany({
    where: {
      recordingRetentionDays: { gt: 0 },
    },
    select: {
      id: true,
      name: true,
      recordingRetentionDays: true,
    },
  });

  let purged = 0;
  let skipped = 0;
  const details: Array<{
    recordingId: string;
    organizationId: string;
    status: string;
  }> = [];

  for (const org of organizations) {
    const retentionDays = org.recordingRetentionDays;
    if (!retentionDays || retentionDays <= 0) {
      continue;
    }

    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const recordings = await prisma.recording.findMany({
      where: {
        organizationId: org.id,
        status: "COMPLETE",
        endedAt: { not: null, lt: cutoff },
      },
      select: {
        id: true,
        downloadUrl: true,
        endedAt: true,
      },
    });

    for (const recording of recordings) {
      if (recording.downloadUrl && !isRemoteDownloadUrl(recording.downloadUrl)) {
        skipped += 1;
        details.push({
          recordingId: recording.id,
          organizationId: org.id,
          status: "skipped_local",
        });
        continue;
      }

      await prisma.recording.update({
        where: { id: recording.id },
        data: {
          status: "ABORTED",
          downloadUrl: null,
          errorMessage: "Dihapus otomatis sesuai kebijakan retensi organisasi.",
        },
      });

      purged += 1;
      details.push({
        recordingId: recording.id,
        organizationId: org.id,
        status: "purged",
      });

      logger.info("Recording purged by retention policy", {
        recordingId: recording.id,
        organizationId: org.id,
        organizationName: org.name,
        retentionDays,
        endedAt: recording.endedAt?.toISOString() ?? null,
      });
    }
  }

  return { purged, skipped, details };
}
