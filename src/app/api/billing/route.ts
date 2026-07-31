import { NextResponse } from "next/server";
import { z } from "zod";
import { absoluteUrl } from "@/lib/app-url";
import { getCurrentSessionContext } from "@/lib/auth";
import {
  getOrganizationUsage,
  resolveOrganizationPlan,
} from "@/lib/billing";
import { prisma } from "@/lib/db";
import { canManageMembers } from "@/lib/organization-helpers";
import {
  createMerchantOrderId,
  getDefaultPaymentProviderId,
  getPaymentProvider,
  listPaymentProviders,
} from "@/lib/payments";
import { getPlatformConfig } from "@/lib/platform-config";
import { writeAuditLog } from "@/lib/organization";

export const runtime = "nodejs";

const checkoutSchema = z.object({
  planCode: z.literal("PRO").default("PRO"),
  provider: z.enum(["MIDTRANS", "IPAYMU", "FLIP"]).optional(),
});

export async function GET() {
  const context = await getCurrentSessionContext();
  if (!context?.activeMembership) {
    return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  }

  const organizationId = context.activeMembership.organization.id;
  const resolved = await resolveOrganizationPlan(organizationId);
  if (!resolved) {
    return NextResponse.json({ error: "Organisasi tidak ditemukan." }, { status: 404 });
  }

  const [usage, orders] = await Promise.all([
    getOrganizationUsage(organizationId),
    prisma.paymentOrder.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        orderId: true,
        provider: true,
        planCode: true,
        amountIdr: true,
        status: true,
        checkoutUrl: true,
        paidAt: true,
        createdAt: true,
      },
    }),
  ]);

  const providers = await listPaymentProviders();
  const defaultProvider = await getDefaultPaymentProviderId();
  const config = await getPlatformConfig();

  return NextResponse.json(
    {
      plan: resolved.plan,
      planCode: resolved.planCode,
      planExpiresAt: resolved.planExpiresAt,
      usage,
      providers,
      defaultProvider,
      canManageBilling: canManageMembers(context.activeMembership.role),
      orders,
      catalog: [config.planCatalog.FREE, config.planCatalog.PRO],
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  try {
    const context = await getCurrentSessionContext();
    if (!context?.activeMembership) {
      return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
    }

    if (!canManageMembers(context.activeMembership.role)) {
      return NextResponse.json(
        { error: "Hanya Owner/Admin yang dapat mengelola billing." },
        { status: 403 },
      );
    }

    const payload: unknown = await request.json();
    const parsed = checkoutSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: "Data checkout tidak valid." }, { status: 400 });
    }

    const config = await getPlatformConfig();
    const plan = config.planCatalog[parsed.data.planCode];
    if (plan.priceIdr <= 0) {
      return NextResponse.json(
        { error: "Plan gratis tidak memerlukan pembayaran." },
        { status: 400 },
      );
    }

    const organizationId = context.activeMembership.organization.id;
    const provider = await getPaymentProvider(parsed.data.provider);
    const orderId = createMerchantOrderId("GMPRO");
    const origin = new URL(request.url).origin;
    const returnUrl = await absoluteUrl(
      `/dashboard/billing?status=return&orderId=${orderId}`,
      origin,
    );
    const cancelUrl = await absoluteUrl(
      `/dashboard/billing?status=cancel&orderId=${orderId}`,
      origin,
    );
    const notifyUrl = await absoluteUrl(
      `/api/payments/webhook/${provider.id.toLowerCase()}`,
      origin,
    );

    const checkout = await provider.createCheckout({
      orderId,
      amountIdr: plan.priceIdr,
      itemName: `GenMeet ${plan.name} (30 hari)`,
      customer: {
        name: context.user.name,
        email: context.user.email,
      },
      returnUrl,
      cancelUrl,
      notifyUrl,
    });

    const order = await prisma.paymentOrder.create({
      data: {
        organizationId,
        createdById: context.user.id,
        provider: provider.id,
        planCode: plan.code,
        orderId,
        amountIdr: plan.priceIdr,
        status: "PENDING",
        providerRef: checkout.providerRef,
        checkoutUrl: checkout.checkoutUrl,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        metadata: checkout.raw as object | undefined,
      },
      select: {
        id: true,
        orderId: true,
        provider: true,
        planCode: true,
        amountIdr: true,
        status: true,
        checkoutUrl: true,
      },
    });

    await writeAuditLog({
      organizationId,
      actorId: context.user.id,
      action: "billing.checkout_created",
      targetType: "payment_order",
      targetId: order.id,
      metadata: {
        provider: provider.id,
        orderId: order.orderId,
        amountIdr: order.amountIdr,
      },
    });

    return NextResponse.json({ order, checkoutUrl: order.checkoutUrl }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Format data tidak valid." }, { status: 400 });
    }

    console.error("Create billing checkout failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Checkout belum dapat dibuat.",
      },
      { status: 500 },
    );
  }
}
