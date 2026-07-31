import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-api";
import { prisma } from "@/lib/db";
import type { MeetingStatus } from "@/generated/prisma/enums";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = new Set([
  "SCHEDULED",
  "ACTIVE",
  "ENDED",
  "CANCELLED",
]);

export async function GET(request: Request) {
  const { context, error } = await requireSuperAdminApi();
  if (error || !context) return error!;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status")?.trim() || "";
  const q = searchParams.get("q")?.trim() || "";
  const take = Math.min(Number(searchParams.get("take") || 50), 100);

  const meetings = await prisma.meeting.findMany({
    where: {
      AND: [
        status && STATUSES.has(status)
          ? { status: status as MeetingStatus }
          : {},
        q
          ? {
              OR: [
                { title: { contains: q } },
                { roomName: { contains: q } },
              ],
            }
          : {},
      ],
    },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      title: true,
      roomName: true,
      status: true,
      startsAt: true,
      actualStartedAt: true,
      endedAt: true,
      createdAt: true,
      organization: { select: { id: true, name: true, slug: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      _count: { select: { participants: true, recordings: true } },
    },
  });

  return NextResponse.json({ meetings });
}
