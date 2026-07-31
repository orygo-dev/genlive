import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-api";
import { getOrganizationUsage, resolveOrganizationPlan } from "@/lib/billing";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const gate = await requireSuperAdminApi();
  if (gate.error || !gate.context) return gate.error!;

  const { id } = await context.params;
  const organization = await prisma.organization.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      planCode: true,
      planExpiresAt: true,
      createdAt: true,
      memberships: {
        orderBy: { joinedAt: "asc" },
        select: {
          role: true,
          joinedAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              isDisabled: true,
              isSuperAdmin: true,
            },
          },
        },
      },
      paymentOrders: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          orderId: true,
          status: true,
          amountIdr: true,
          planCode: true,
          provider: true,
          createdAt: true,
          paidAt: true,
        },
      },
    },
  });

  if (!organization) {
    return NextResponse.json({ error: "Organisasi tidak ditemukan." }, { status: 404 });
  }

  const [resolved, usage] = await Promise.all([
    resolveOrganizationPlan(id),
    getOrganizationUsage(id),
  ]);

  return NextResponse.json({
    organization: {
      ...organization,
      planCode: resolved?.planCode ?? organization.planCode,
      planExpiresAt: resolved?.planExpiresAt ?? organization.planExpiresAt,
      plan: resolved?.plan ?? null,
      usage,
    },
  });
}
