import { createHash, createHmac, randomBytes } from "node:crypto";

export type PaymentProviderId = "MIDTRANS" | "IPAYMU" | "FLIP";

export type CheckoutRequest = {
  orderId: string;
  amountIdr: number;
  itemName: string;
  customer: {
    name: string;
    email: string;
    phone?: string;
  };
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
};

export type CheckoutResult = {
  provider: PaymentProviderId;
  checkoutUrl: string;
  providerRef?: string;
  raw?: unknown;
};

export type NormalizedPaymentEvent = {
  orderId: string;
  status: "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "CANCELLED";
  providerRef?: string;
  amountIdr?: number;
  raw: unknown;
};

export type PaymentProvider = {
  id: PaymentProviderId;
  label: string;
  isConfigured: () => boolean;
  createCheckout: (input: CheckoutRequest) => Promise<CheckoutResult>;
  parseWebhook: (
    body: unknown,
    headers: Headers,
  ) => Promise<NormalizedPaymentEvent>;
};

export function createMerchantOrderId(prefix = "GM") {
  const stamp = Date.now().toString(36).toUpperCase();
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}-${stamp}-${suffix}`.slice(0, 50);
}

export function sha512Hex(value: string) {
  return createHash("sha512").update(value).digest("hex");
}

export function hmacSha256Hex(secret: string, value: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function basicAuthHeader(username: string, password = "") {
  const token = Buffer.from(`${username}:${password}`).toString("base64");
  return `Basic ${token}`;
}
