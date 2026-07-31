import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdminApi } from "@/lib/admin-api";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const bodySchema = z.object({
  supportEmail: z
    .string()
    .trim()
    .email("Email dukungan tidak valid.")
    .max(255)
    .nullable()
    .optional()
    .or(z.literal("")),
  maintenanceMode: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  const gate = await requireSuperAdminApi();
  if (gate.error || !gate.context) return gate.error!;

  const payload: unknown = await request.json();
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const supportEmail =
    parsed.data.supportEmail === "" || parsed.data.supportEmail === undefined
      ? parsed.data.supportEmail === ""
        ? null
        : undefined
      : parsed.data.supportEmail;

  const settings = await prisma.platformSettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      supportEmail: supportEmail ?? null,
      maintenanceMode: parsed.data.maintenanceMode ?? false,
      updatedById: gate.context.user.id,
    },
    update: {
      ...(supportEmail !== undefined ? { supportEmail } : {}),
      ...(parsed.data.maintenanceMode !== undefined
        ? { maintenanceMode: parsed.data.maintenanceMode }
        : {}),
      updatedById: gate.context.user.id,
    },
    select: {
      supportEmail: true,
      maintenanceMode: true,
      appName: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ system: settings });
}
