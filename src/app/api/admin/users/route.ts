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
  const take = Math.min(Number(searchParams.get("take") || 50), 100);

  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { email: { contains: q } },
            { name: { contains: q } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      name: true,
      email: true,
      isSuperAdmin: true,
      createdAt: true,
      memberships: {
        select: {
          role: true,
          organization: {
            select: { id: true, name: true, planCode: true },
          },
        },
      },
      _count: { select: { sessions: true } },
    },
  });

  return NextResponse.json({
    users: users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
      createdAt: user.createdAt,
      sessionCount: user._count.sessions,
      organizations: user.memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        planCode: m.organization.planCode,
        role: m.role,
      })),
    })),
  });
}
