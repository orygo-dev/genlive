import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-api";
import { prisma } from "@/lib/db";
import type { PaymentOrderStatus } from "@/generated/prisma/enums";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = new Set([
  "PENDING",
  "PAID",
  "FAILED",
  "EXPIRED",
  "CANCELLED",
]);

export async function GET(request: Request) {
  const { context, error } = await requireSuperAdminApi();
  if (error || !context) return error!;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status")?.trim() || "";
  const take = Math.min(Number(searchParams.get("take") || 50), 100);

  const orders = await prisma.paymentOrder.findMany({
    where: status && STATUSES.has(status)
      ? { status: status as PaymentOrderStatus }
      : undefined,
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      provider: true,
      status: true,
      amountIdr: true,
      planCode: true,
      orderId: true,
      providerRef: true,
      createdAt: true,
      paidAt: true,
      organization: {
        select: { id: true, name: true, slug: true },
      },
      createdBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  return NextResponse.json({ orders });
}
