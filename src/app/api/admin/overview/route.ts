import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-api";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { context, error } = await requireSuperAdminApi();
  if (error || !context) return error!;

  const [
    userCount,
    organizationCount,
    proOrgCount,
    freeOrgCount,
    activeMeetingCount,
    meetingCount,
    paidOrderCount,
    pendingOrderCount,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.organization.count(),
    prisma.organization.count({ where: { planCode: "PRO" } }),
    prisma.organization.count({ where: { planCode: "FREE" } }),
    prisma.meeting.count({ where: { status: "ACTIVE" } }),
    prisma.meeting.count(),
    prisma.paymentOrder.count({ where: { status: "PAID" } }),
    prisma.paymentOrder.count({ where: { status: "PENDING" } }),
  ]);

  return NextResponse.json({
    overview: {
      userCount,
      organizationCount,
      proOrgCount,
      freeOrgCount,
      activeMeetingCount,
      meetingCount,
      paidOrderCount,
      pendingOrderCount,
      livekitConfigured: Boolean(
        process.env.LIVEKIT_URL &&
          process.env.LIVEKIT_API_KEY &&
          process.env.LIVEKIT_API_SECRET,
      ),
      paymentProvider: process.env.PAYMENT_PROVIDER || "MIDTRANS",
      appUrl: process.env.APP_URL || null,
    },
  });
}
