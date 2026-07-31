import { flipProvider } from "@/lib/payments/flip";
import { ipaymuProvider } from "@/lib/payments/ipaymu";
import { midtransProvider } from "@/lib/payments/midtrans";
import type { PaymentProvider, PaymentProviderId } from "@/lib/payments/types";
import { getPlatformConfig } from "@/lib/platform-config";

const providers: Record<PaymentProviderId, PaymentProvider> = {
  MIDTRANS: midtransProvider,
  IPAYMU: ipaymuProvider,
  FLIP: flipProvider,
};

export async function listPaymentProviders() {
  return Promise.all(
    Object.values(providers).map(async (provider) => ({
      id: provider.id,
      label: provider.label,
      configured: await provider.isConfigured(),
    })),
  );
}

export async function getDefaultPaymentProviderId(): Promise<PaymentProviderId> {
  const config = await getPlatformConfig();
  const configured = config.paymentProvider?.trim().toUpperCase();
  if (configured === "IPAYMU" || configured === "FLIP" || configured === "MIDTRANS") {
    return configured;
  }

  if (await midtransProvider.isConfigured()) return "MIDTRANS";
  if (await ipaymuProvider.isConfigured()) return "IPAYMU";
  if (await flipProvider.isConfigured()) return "FLIP";
  return "MIDTRANS";
}

export async function getPaymentProvider(id?: string | null): Promise<PaymentProvider> {
  const normalized = (id ?? (await getDefaultPaymentProviderId())).toUpperCase();
  const provider =
    providers[normalized as PaymentProviderId] ??
    providers[await getDefaultPaymentProviderId()];

  if (!(await provider.isConfigured())) {
    throw new Error(
      `Gateway ${provider.label} belum dikonfigurasi. Isi di Super Admin → Integrasi atau .env.`,
    );
  }

  return provider;
}

export function getPaymentProviderForWebhook(id: PaymentProviderId): PaymentProvider {
  return providers[id];
}

export { createMerchantOrderId } from "@/lib/payments/types";
export type { PaymentProviderId, NormalizedPaymentEvent } from "@/lib/payments/types";
