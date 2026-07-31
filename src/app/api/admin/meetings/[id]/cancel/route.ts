import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-api";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/organization";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const gate = await requireSuperAdminApi();
  if (gate.error || !gate.context) return gate.error!;

  const { id } = await context.params;
  const meeting = await prisma.meeting.findUnique({
    where: { id },
    select: { id: true, status: true, organizationId: true, title: true },
  });
  if (!meeting) {
    return NextResponse.json({ error: "Meeting tidak ditemukan." }, { status: 404 });
  }

  const updated = await prisma.meeting.update({
    where: { id },
    data: {
      status: "CANCELLED",
      endedAt: meeting.status === "ACTIVE" ? new Date() : undefined,
    },
    select: {
      id: true,
      title: true,
      status: true,
      endedAt: true,
    },
  });

  await writeAuditLog({
    organizationId: meeting.organizationId,
    actorId: gate.context.user.id,
    action: "meeting.force_cancelled",
    targetType: "meeting",
    targetId: id,
    metadata: { title: meeting.title },
  });

  return NextResponse.json({ meeting: updated });
}
