import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-api";
import { prisma } from "@/lib/db";
import { resolveOrganizationPlan } from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { context, error } = await requireSuperAdminApi();
  if (error || !context) return error!;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || "";
  const take = Math.min(Number(searchParams.get("take") || 50), 100);

  const organizations = await prisma.organization.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q } },
            { slug: { contains: q } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      name: true,
      slug: true,
      planCode: true,
      planExpiresAt: true,
      createdAt: true,
      _count: {
        select: {
          memberships: true,
          meetings: true,
        },
      },
    },
  });

  const items = await Promise.all(
    organizations.map(async (org) => {
      const resolved = await resolveOrganizationPlan(org.id);
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        planCode: resolved?.planCode ?? org.planCode,
        planExpiresAt: resolved?.planExpiresAt ?? org.planExpiresAt,
        planName: resolved?.plan.name ?? org.planCode,
        memberCount: org._count.memberships,
        meetingCount: org._count.meetings,
        createdAt: org.createdAt,
      };
    }),
  );

  return NextResponse.json({ organizations: items });
}
