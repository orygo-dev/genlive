import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdminApi } from "@/lib/admin-api";
import { getOrganizationUsage, resolveOrganizationPlan } from "@/lib/billing";
import { organizationNameSchema } from "@/lib/auth-validation";
import { prisma } from "@/lib/db";
import { createOrganizationSlug, writeAuditLog } from "@/lib/organization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: organizationNameSchema.optional(),
  planCode: z.enum(["FREE", "PRO"]).optional(),
});

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

export async function PATCH(request: Request, context: RouteContext) {
  const gate = await requireSuperAdminApi();
  if (gate.error || !gate.context) return gate.error!;

  const { id } = await context.params;
  const payload: unknown = await request.json();
  const parsed = patchSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const existing = await prisma.organization.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Organisasi tidak ditemukan." }, { status: 404 });
  }

  const data: { name?: string; slug?: string; planCode?: "FREE" | "PRO"; planExpiresAt?: Date | null } =
    {};
  if (parsed.data.name) {
    data.name = parsed.data.name;
    data.slug = createOrganizationSlug(parsed.data.name);
  }
  if (parsed.data.planCode) {
    data.planCode = parsed.data.planCode;
    if (parsed.data.planCode === "FREE") data.planExpiresAt = null;
  }

  const organization = await prisma.organization.update({
    where: { id },
    data,
    select: {
      id: true,
      name: true,
      slug: true,
      planCode: true,
      planExpiresAt: true,
      createdAt: true,
    },
  });

  await writeAuditLog({
    organizationId: id,
    actorId: gate.context.user.id,
    action: "organization.updated",
    targetType: "organization",
    targetId: id,
    metadata: parsed.data,
  });

  return NextResponse.json({ organization });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const gate = await requireSuperAdminApi();
  if (gate.error || !gate.context) return gate.error!;

  const { id } = await context.params;
  const existing = await prisma.organization.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Organisasi tidak ditemukan." }, { status: 404 });
  }

  await prisma.organization.delete({ where: { id } });
  return NextResponse.json({ ok: true, deleted: existing.name });
}
