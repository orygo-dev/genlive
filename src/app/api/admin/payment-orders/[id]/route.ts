import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdminApi } from "@/lib/admin-api";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/organization";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  action: z.enum(["cancel", "refund"]),
});

export async function PATCH(request: Request, context: RouteContext) {
  const gate = await requireSuperAdminApi();
  if (gate.error || !gate.context) return gate.error!;

  const { id } = await context.params;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Format data tidak valid." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const order = await prisma.paymentOrder.findUnique({
    where: { id },
    select: {
      id: true,
      orderId: true,
      status: true,
      organizationId: true,
      amountIdr: true,
      planCode: true,
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Order tidak ditemukan." }, { status: 404 });
  }

  if (parsed.data.action === "cancel") {
    if (order.status !== "PENDING") {
      return NextResponse.json(
        { error: "Hanya order PENDING yang dapat dibatalkan." },
        { status: 409 },
      );
    }

    const updated = await prisma.paymentOrder.update({
      where: { id },
      data: { status: "CANCELLED" },
      select: { id: true, orderId: true, status: true },
    });

    await writeAuditLog({
      organizationId: order.organizationId,
      actorId: gate.context.user.id,
      action: "billing.order_cancelled",
      targetType: "payment_order",
      targetId: order.id,
      metadata: { orderId: order.orderId },
    });

    return NextResponse.json({ order: updated });
  }

  if (order.status !== "PAID") {
    return NextResponse.json(
      { error: "Hanya order PAID yang dapat direfund." },
      { status: 409 },
    );
  }

  const updated = await prisma.paymentOrder.update({
    where: { id },
    data: { status: "REFUNDED" },
    select: { id: true, orderId: true, status: true },
  });

  await writeAuditLog({
    organizationId: order.organizationId,
    actorId: gate.context.user.id,
    action: "billing.order_refunded",
    targetType: "payment_order",
    targetId: order.id,
    metadata: {
      orderId: order.orderId,
      amountIdr: order.amountIdr,
      note: "Status direfund di sistem. Refund gateway harus diproses manual di provider.",
    },
  });

  logger.info("Payment order refunded by admin", {
    orderId: order.orderId,
    adminId: gate.context.user.id,
  });

  return NextResponse.json({ order: updated });
}
