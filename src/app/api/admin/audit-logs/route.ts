import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-api";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { context, error } = await requireSuperAdminApi();
  if (error || !context) return error!;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || "";
  const take = Math.min(Number(searchParams.get("take") || 80), 150);

  const logs = await prisma.auditLog.findMany({
    where: q
      ? {
          OR: [
            { action: { contains: q } },
            { targetType: { contains: q } },
            { organization: { name: { contains: q } } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      action: true,
      targetType: true,
      targetId: true,
      metadata: true,
      createdAt: true,
      organization: { select: { id: true, name: true, slug: true } },
      actor: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ logs });
}
