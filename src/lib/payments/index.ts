import { flipProvider } from "@/lib/payments/flip";
import { ipaymuProvider } from "@/lib/payments/ipaymu";
import { midtransProvider } from "@/lib/payments/midtrans";
import type { PaymentProvider, PaymentProviderId } from "@/lib/payments/types";

const providers: Record<PaymentProviderId, PaymentProvider> = {
  MIDTRANS: midtransProvider,
  IPAYMU: ipaymuProvider,
  FLIP: flipProvider,
};

export function listPaymentProviders() {
  return Object.values(providers).map((provider) => ({
    id: provider.id,
    label: provider.label,
    configured: provider.isConfigured(),
  }));
}

export function getDefaultPaymentProviderId(): PaymentProviderId {
  const configured = process.env.PAYMENT_PROVIDER?.trim().toUpperCase();
  if (configured === "IPAYMU" || configured === "FLIP" || configured === "MIDTRANS") {
    return configured;
  }

  if (midtransProvider.isConfigured()) return "MIDTRANS";
  if (ipaymuProvider.isConfigured()) return "IPAYMU";
  if (flipProvider.isConfigured()) return "FLIP";
  return "MIDTRANS";
}

export function getPaymentProvider(id?: string | null): PaymentProvider {
  const normalized = (id ?? getDefaultPaymentProviderId()).toUpperCase();
  const provider =
    providers[normalized as PaymentProviderId] ??
    providers[getDefaultPaymentProviderId()];

  if (!provider.isConfigured()) {
    throw new Error(
      `Gateway ${provider.label} belum dikonfigurasi. Isi kredensial di .env.local.`,
    );
  }

  return provider;
}

export function getPaymentProviderForWebhook(id: PaymentProviderId): PaymentProvider {
  return providers[id];
}

export { createMerchantOrderId } from "@/lib/payments/types";
export type { PaymentProviderId, NormalizedPaymentEvent } from "@/lib/payments/types";
