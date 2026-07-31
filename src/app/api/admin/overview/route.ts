import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-api";
import { prisma } from "@/lib/db";
import { getPlatformConfig } from "@/lib/platform-config";

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
    recentUsers,
    recentOrganizations,
    recentOrders,
    recentMeetings,
    config,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.organization.count(),
    prisma.organization.count({ where: { planCode: "PRO" } }),
    prisma.organization.count({ where: { planCode: "FREE" } }),
    prisma.meeting.count({ where: { status: "ACTIVE" } }),
    prisma.meeting.count(),
    prisma.paymentOrder.count({ where: { status: "PAID" } }),
    prisma.paymentOrder.count({ where: { status: "PENDING" } }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, email: true, createdAt: true, isDisabled: true },
    }),
    prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, slug: true, planCode: true, createdAt: true },
    }),
    prisma.paymentOrder.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        orderId: true,
        status: true,
        amountIdr: true,
        createdAt: true,
        organization: { select: { name: true } },
      },
    }),
    prisma.meeting.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        status: true,
        roomName: true,
        createdAt: true,
        organization: { select: { name: true } },
      },
    }),
    getPlatformConfig(),
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
        config.livekitUrl && config.livekitApiKey && config.livekitApiSecret,
      ),
      paymentProvider: config.paymentProvider || "MIDTRANS",
      appUrl: config.appUrl || null,
      recentUsers,
      recentOrganizations,
      recentOrders,
      recentMeetings,
    },
  });
}
