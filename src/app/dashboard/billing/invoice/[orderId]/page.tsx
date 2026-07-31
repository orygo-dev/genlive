import { notFound } from "next/navigation";
import { requireActiveMembership } from "@/lib/dashboard-guard";
import { prisma } from "@/lib/db";
import { buildInvoiceHtml } from "@/lib/invoice";
import { getPlatformBranding } from "@/lib/platform-settings";

export const dynamic = "force-dynamic";

type InvoicePageProps = {
  params: Promise<{ orderId: string }>;
};

export default async function InvoicePage({ params }: InvoicePageProps) {
  const { orderId } = await params;
  const context = await requireActiveMembership();
  const branding = await getPlatformBranding();
  const orgId = context.activeMembership.organization.id;

  const order = await prisma.paymentOrder.findFirst({
    where: {
      OR: [{ id: orderId }, { orderId }],
      organizationId: orgId,
      status: { in: ["PAID", "REFUNDED"] },
    },
    select: {
      orderId: true,
      planCode: true,
      amountIdr: true,
      status: true,
      provider: true,
      paidAt: true,
      createdAt: true,
      organization: { select: { name: true } },
      createdBy: { select: { name: true, email: true } },
    },
  });

  if (!order) {
    notFound();
  }

  const html = buildInvoiceHtml({
    order: {
      ...order,
      paidAt: order.paidAt,
      createdAt: order.createdAt,
    },
    org: order.organization,
    buyer: order.createdBy,
    appName: branding.appName,
  });

  return (
    <div dangerouslySetInnerHTML={{ __html: html }} />
  );
}
