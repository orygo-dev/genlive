import { NextResponse } from "next/server";
import { getCurrentSessionContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManageMembers } from "@/lib/organization-helpers";

export const runtime = "nodejs";

function csvEscape(value: string) {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET() {
  try {
    const context = await getCurrentSessionContext();
    if (!context?.activeMembership) {
      return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
    }

    if (!canManageMembers(context.activeMembership.role)) {
      return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
    }

    const organizationId = context.activeMembership.organization.id;
    const logs = await prisma.auditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 10_000,
      select: {
        id: true,
        action: true,
        targetType: true,
        targetId: true,
        metadata: true,
        createdAt: true,
        actor: { select: { email: true, name: true } },
      },
    });

    const header = [
      "id",
      "created_at",
      "action",
      "target_type",
      "target_id",
      "actor_email",
      "actor_name",
      "metadata",
    ].join(",");

    const rows = logs.map((log) =>
      [
        log.id,
        log.createdAt.toISOString(),
        log.action,
        log.targetType,
        log.targetId ?? "",
        log.actor?.email ?? "",
        log.actor?.name ?? "",
        log.metadata ? JSON.stringify(log.metadata) : "",
      ]
        .map((cell) => csvEscape(String(cell)))
        .join(","),
    );

    const csv = [header, ...rows].join("\n");
    const filename = `audit-log-${context.activeMembership.organization.slug}-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Audit export failed", error);
    return NextResponse.json(
      { error: "Ekspor audit log gagal." },
      { status: 500 },
    );
  }
}
