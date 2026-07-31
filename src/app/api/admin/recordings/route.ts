import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-api";
import { prisma } from "@/lib/db";
import type { RecordingStatus } from "@/generated/prisma/enums";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = new Set([
  "STARTING",
  "ACTIVE",
  "ENDING",
  "COMPLETE",
  "FAILED",
  "ABORTED",
]);

export async function GET(request: Request) {
  const { context, error } = await requireSuperAdminApi();
  if (error || !context) return error!;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status")?.trim() || "";
  const take = Math.min(Number(searchParams.get("take") || 50), 100);

  const recordings = await prisma.recording.findMany({
    where:
      status && STATUSES.has(status)
        ? { status: status as RecordingStatus }
        : undefined,
    orderBy: { startedAt: "desc" },
    take,
    select: {
      id: true,
      egressId: true,
      status: true,
      durationSeconds: true,
      downloadUrl: true,
      errorMessage: true,
      startedAt: true,
      endedAt: true,
      organization: { select: { id: true, name: true } },
      meeting: { select: { id: true, title: true, roomName: true } },
      startedBy: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ recordings });
}
