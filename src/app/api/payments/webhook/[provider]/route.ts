import { NextResponse } from "next/server";
import { activatePaidPlan } from "@/lib/billing";
import { absoluteUrl } from "@/lib/app-url";
import { prisma } from "@/lib/db";
import { buildPaymentInvoiceEmail } from "@/lib/email-templates";
import { sendEmail } from "@/lib/email";
import { getPaymentProviderForWebhook, type PaymentProviderId } from "@/lib/payments";
import { amountsMatchIdr } from "@/lib/payments/webhook-security";
import { writeAuditLog } from "@/lib/organization";
import { getPlatformBranding } from "@/lib/platform-settings";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

type WebhookRouteProps = {
  params: Promise<{ provider: string }>;
};

function normalizeProvider(value: string): PaymentProviderId | null {
  const upper = value.trim().toUpperCase();
  if (upper === "MIDTRANS" || upper === "IPAYMU" || upper === "FLIP") {
    return upper;
  }
  return null;
}

export async function POST(request: Request, { params }: WebhookRouteProps) {
  try {
    const { provider: providerParam } = await params;
    const providerId = normalizeProvider(providerParam);
    if (!providerId) {
      return NextResponse.json({ error: "Provider tidak dikenal." }, { status: 404 });
    }

    const provider = getPaymentProviderForWebhook(providerId);
    const contentType = request.headers.get("content-type") ?? "";
    let body: unknown;

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const form = await request.formData();
      body = Object.fromEntries(form.entries());
    } else {
      body = await request.json();
    }

    const event = await provider.parseWebhook(body, request.headers);
    let order = await prisma.paymentOrder.findUnique({
      where: { orderId: event.orderId },
      select: {
        id: true,
        organizationId: true,
        createdById: true,
        planCode: true,
        status: true,
        amountIdr: true,
        provider: true,
        orderId: true,
      },
    });

    if (!order && event.providerRef) {
      order = await prisma.paymentOrder.findFirst({
        where: {
          provider: providerId,
          providerRef: event.providerRef,
        },
        select: {
          id: true,
          organizationId: true,
          createdById: true,
          planCode: true,
          status: true,
          amountIdr: true,
          provider: true,
          orderId: true,
        },
      });
    }

    if (!order) {
      return NextResponse.json({ received: true, ignored: "order_not_found" });
    }

    if (order.provider !== providerId) {
      return NextResponse.json({ error: "Provider tidak cocok." }, { status: 409 });
    }

    if (order.status === "PAID") {
      return NextResponse.json({ received: true, duplicate: true });
    }

    if (event.status === "PAID") {
      if (!amountsMatchIdr(order.amountIdr, event.amountIdr)) {
        console.error("Payment webhook amount mismatch", {
          provider: providerId,
          orderId: order.id,
          expected: order.amountIdr,
          reported: event.amountIdr,
        });
        return NextResponse.json(
          { error: "Jumlah pembayaran tidak cocok dengan order." },
          { status: 400 },
        );
      }

      await prisma.paymentOrder.update({
        where: { id: order.id },
        data: {
          status: "PAID",
          paidAt: new Date(),
          providerRef: event.providerRef ?? undefined,
          metadata: event.raw as object,
        },
      });

      await activatePaidPlan({
        organizationId: order.organizationId,
        planCode: order.planCode === "PRO" ? "PRO" : "FREE",
        actorId: order.createdById,
        orderId: order.id,
        provider: providerId,
      });

      await writeAuditLog({
        organizationId: order.organizationId,
        actorId: order.createdById,
        action: "billing.payment_paid",
        targetType: "payment_order",
        targetId: order.id,
        metadata: {
          provider: providerId,
          amountIdr: order.amountIdr,
        },
      });

      try {
        const [buyer, branding] = await Promise.all([
          prisma.user.findUnique({
            where: { id: order.createdById },
            select: { name: true, email: true },
          }),
          getPlatformBranding(),
        ]);

        if (buyer) {
          const invoiceUrl = await absoluteUrl(
            `/dashboard/billing/invoice/${order.id}`,
          );
          const message = buildPaymentInvoiceEmail({
            appName: branding.appName,
            userName: buyer.name,
            planCode: order.planCode,
            amountIdr: order.amountIdr,
            invoiceUrl,
          });
          void sendEmail({ to: buyer.email, ...message }).catch((error) => {
            logger.warn("Invoice email failed after payment", {
              orderId: order.orderId,
              error: error instanceof Error ? error.message : String(error),
            });
          });
        }
      } catch (error) {
        logger.warn("Invoice email setup failed after payment", {
          orderId: order.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } else if (
      event.status === "FAILED" ||
      event.status === "EXPIRED" ||
      event.status === "CANCELLED"
    ) {
      await prisma.paymentOrder.update({
        where: { id: order.id },
        data: {
          status: event.status,
          providerRef: event.providerRef ?? undefined,
          metadata: event.raw as object,
        },
      });
    } else {
      await prisma.paymentOrder.update({
        where: { id: order.id },
        data: {
          status: "PENDING",
          providerRef: event.providerRef ?? undefined,
          metadata: event.raw as object,
        },
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Payment webhook failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Webhook gagal diproses.",
      },
      { status: 400 },
    );
  }
}
