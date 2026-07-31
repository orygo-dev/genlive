import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdminApi } from "@/lib/admin-api";
import {
  getPlatformConfig,
  savePlanCatalog,
} from "@/lib/platform-config";
import {
  DEFAULT_PLAN_CATALOG,
  normalizePlanCatalog,
  type PlanDefinition,
} from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const planSchema = z.object({
  name: z.string().trim().min(2).max(80),
  priceIdr: z.number().int().min(0),
  billingPeriodDays: z.number().int().min(0).max(3650),
  maxMembers: z.number().int().min(1).max(100000),
  maxMeetingsPerMonth: z.number().int().min(1).max(1000000),
  maxMeetingMinutesPerMonth: z.number().int().min(0).max(10_000_000),
  maxRecordingMinutesPerMonth: z.number().int().min(0).max(10_000_000),
  features: z.array(z.string().trim().min(1).max(200)).max(20),
});

const bodySchema = z.object({
  FREE: planSchema,
  PRO: planSchema,
});

export async function GET() {
  const gate = await requireSuperAdminApi();
  if (gate.error || !gate.context) return gate.error!;

  const config = await getPlatformConfig();
  return NextResponse.json({
    plans: config.planCatalog,
    defaults: DEFAULT_PLAN_CATALOG,
  });
}

export async function PATCH(request: Request) {
  const gate = await requireSuperAdminApi();
  if (gate.error || !gate.context) return gate.error!;

  const payload: unknown = await request.json();
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data plan tidak valid." },
      { status: 400 },
    );
  }

  const catalog = normalizePlanCatalog({
    FREE: { ...parsed.data.FREE, code: "FREE" } satisfies PlanDefinition,
    PRO: { ...parsed.data.PRO, code: "PRO" } satisfies PlanDefinition,
  });

  const saved = await savePlanCatalog(catalog, gate.context.user.id);
  return NextResponse.json({ plans: saved });
}
