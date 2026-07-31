import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-api";
import { prisma } from "@/lib/db";
import { PLANS } from "@/lib/plans";
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

  const [sessionCount, disabledUsers, failedRecordings] = await Promise.all([
    prisma.session.count({ where: { expiresAt: { gt: new Date() } } }),
    prisma.user.count({ where: { isDisabled: true } }),
    prisma.recording.count({ where: { status: "FAILED" } }),
  ]);

  return NextResponse.json({
    system: {
      appName: settings.appName,
      supportEmail: settings.supportEmail,
      maintenanceMode: settings.maintenanceMode,
      updatedAt: settings.updatedAt,
      appUrl: process.env.APP_URL || null,
      nodeEnv: process.env.NODE_ENV || null,
      paymentProvider: process.env.PAYMENT_PROVIDER || "MIDTRANS",
      livekitConfigured: Boolean(
        process.env.LIVEKIT_URL &&
          process.env.LIVEKIT_API_KEY &&
          process.env.LIVEKIT_API_SECRET,
      ),
      emailConfigured: Boolean(
        process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim(),
      ),
      whatsappConfigured: Boolean(process.env.FONNTE_TOKEN?.trim()),
      cronConfigured: Boolean(process.env.CRON_SECRET?.trim()),
      superAdminEmails: getConfiguredSuperAdminEmails(),
      activeSessions: sessionCount,
      disabledUsers,
      failedRecordings,
      plans: Object.values(PLANS),
    },
  });
}
