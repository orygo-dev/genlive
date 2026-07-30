import { createHash } from "node:crypto";
import {
  hmacSha256Hex,
  type CheckoutRequest,
  type CheckoutResult,
  type NormalizedPaymentEvent,
  type PaymentProvider,
} from "@/lib/payments/types";

function ipaymuConfig() {
  const va = process.env.IPAYMU_VA?.trim();
  const apiKey = process.env.IPAYMU_API_KEY?.trim();
  const isProduction = process.env.IPAYMU_IS_PRODUCTION === "true";
  return { va, apiKey, isProduction };
}

function ipaymuBaseUrl(isProduction: boolean) {
  return isProduction
    ? "https://my.ipaymu.com"
    : "https://sandbox.ipaymu.com";
}

function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export const ipaymuProvider: PaymentProvider = {
  id: "IPAYMU",
  label: "iPaymu",
  isConfigured() {
    const { va, apiKey } = ipaymuConfig();
    return Boolean(va && apiKey);
  },
  async createCheckout(input: CheckoutRequest): Promise<CheckoutResult> {
    const { va, apiKey, isProduction } = ipaymuConfig();
    if (!va || !apiKey) {
      throw new Error("iPaymu belum dikonfigurasi.");
    }

    const body = {
      product: [input.itemName.slice(0, 64)],
      qty: ["1"],
      price: [String(input.amountIdr)],
      returnUrl: input.returnUrl,
      cancelUrl: input.cancelUrl,
      notifyUrl: input.notifyUrl,
      referenceId: input.orderId,
      buyerName: input.customer.name,
      buyerEmail: input.customer.email,
      buyerPhone: input.customer.phone || "08123456789",
      expired: 24,
      expiredType: "hours",
    };

    const timestamp = Date.now().toString();
    const bodyString = JSON.stringify(body);
    const bodyHash = sha256Hex(bodyString);
    const stringToSign = `POST:${va}:${bodyHash}:${apiKey}`;
    const signature = hmacSha256Hex(apiKey, stringToSign);

    const response = await fetch(`${ipaymuBaseUrl(isProduction)}/api/v2/payment`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        va,
        signature,
        timestamp,
      },
      body: bodyString,
    });

    const payload = (await response.json()) as {
      Status?: number;
      Message?: string;
      Data?: {
        SessionID?: string;
        Url?: string;
        TransactionId?: number | string;
      };
    };

    if (!response.ok || payload.Status !== 200 || !payload.Data?.Url) {
      throw new Error(payload.Message || "Checkout iPaymu gagal dibuat.");
    }

    return {
      provider: "IPAYMU",
      checkoutUrl: payload.Data.Url,
      providerRef: String(
        payload.Data.SessionID || payload.Data.TransactionId || "",
      ),
      raw: payload,
    };
  },
  async parseWebhook(body: unknown): Promise<NormalizedPaymentEvent> {
    const payload = body as Record<string, unknown>;
    const orderId = String(
      payload.reference_id ||
        payload.referenceId ||
        payload.ReferenceId ||
        "",
    );
    const statusRaw = String(
      payload.status || payload.Status || payload.status_code || "",
    ).toLowerCase();
    const trxId = String(
      payload.trx_id || payload.trxId || payload.TransactionId || "",
    );

    if (!orderId) {
      throw new Error("Webhook iPaymu tanpa reference order.");
    }

    let status: NormalizedPaymentEvent["status"] = "PENDING";
    if (
      statusRaw === "berhasil" ||
      statusRaw === "success" ||
      statusRaw === "1" ||
      statusRaw === "paid"
    ) {
      status = "PAID";
    } else if (
      statusRaw === "gagal" ||
      statusRaw === "failed" ||
      statusRaw === "-1"
    ) {
      status = "FAILED";
    } else if (statusRaw === "expired" || statusRaw === "kadaluarsa") {
      status = "EXPIRED";
    }

    return {
      orderId,
      status,
      providerRef: trxId || undefined,
      amountIdr: Number(payload.amount || payload.Total || 0) || undefined,
      raw: payload,
    };
  },
};
