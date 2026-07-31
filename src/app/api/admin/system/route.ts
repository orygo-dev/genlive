import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-api";
import { prisma } from "@/lib/db";
import { getPlatformConfig } from "@/lib/platform-config";
import { getConfiguredSuperAdminEmails } from "@/lib/super-admin-emails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { context, error } = await requireSuperAdminApi();
  if (error || !context) return error!;

  const settings = await prisma.platformSettings.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
    select: {
      supportEmail: true,
      maintenanceMode: true,
      appName: true,
      updatedAt: true,
    },
  });

  const [sessionCount, disabledUsers, failedRecordings, config] = await Promise.all([
    prisma.session.count({ where: { expiresAt: { gt: new Date() } } }),
    prisma.user.count({ where: { isDisabled: true } }),
    prisma.recording.count({ where: { status: "FAILED" } }),
    getPlatformConfig(),
  ]);

  return NextResponse.json({
    system: {
      appName: settings.appName,
      supportEmail: settings.supportEmail,
      maintenanceMode: settings.maintenanceMode,
      updatedAt: settings.updatedAt,
      appUrl: config.appUrl || null,
      nodeEnv: process.env.NODE_ENV || null,
      paymentProvider: config.paymentProvider || "MIDTRANS",
      livekitConfigured: Boolean(
        config.livekitUrl && config.livekitApiKey && config.livekitApiSecret,
      ),
      emailConfigured: Boolean(config.resendApiKey?.trim() && config.emailFrom?.trim()),
      whatsappConfigured: Boolean(config.fonnteToken?.trim()),
      cronConfigured: Boolean(config.cronSecret?.trim()),
      superAdminEmails: getConfiguredSuperAdminEmails(),
      activeSessions: sessionCount,
      disabledUsers,
      failedRecordings,
      plans: Object.values(config.planCatalog),
    },
  });
}
