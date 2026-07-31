import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdminApi } from "@/lib/admin-api";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/organization";
import { resolvePlan } from "@/lib/platform-config";

export const runtime = "nodejs";

const bodySchema = z.object({
  planCode: z.enum(["FREE", "PRO"]),
  periodDays: z.number().int().min(0).max(3650).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const gate = await requireSuperAdminApi();
  if (gate.error || !gate.context) return gate.error!;

  const { id } = await context.params;
  const payload: unknown = await request.json();
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const organization = await prisma.organization.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!organization) {
    return NextResponse.json({ error: "Organisasi tidak ditemukan." }, { status: 404 });
  }

  const { planCode } = parsed.data;
  let expiresAt: Date | null = null;

  if (planCode === "PRO") {
    const plan = await resolvePlan("PRO");
    const days = parsed.data.periodDays ?? plan.billingPeriodDays;
    expiresAt = days > 0 ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null;
  }

  const updated = await prisma.organization.update({
    where: { id },
    data: {
      planCode,
      planExpiresAt: expiresAt,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      planCode: true,
      planExpiresAt: true,
    },
  });

  await writeAuditLog({
    organizationId: id,
    actorId: gate.context.user.id,
    action: "billing.plan_activated",
    targetType: "organization",
    targetId: id,
    metadata: {
      planCode,
      provider: "ADMIN_MANUAL",
      expiresAt: expiresAt?.toISOString() ?? null,
      periodDays: parsed.data.periodDays ?? null,
    },
  });

  return NextResponse.json({ organization: updated });
}
