import {
  basicAuthHeader,
  type CheckoutRequest,
  type CheckoutResult,
  type NormalizedPaymentEvent,
  type PaymentProvider,
} from "@/lib/payments/types";

function flipConfig() {
  const secretKey = process.env.FLIP_SECRET_KEY?.trim();
  const validationToken = process.env.FLIP_VALIDATION_TOKEN?.trim();
  const isProduction = process.env.FLIP_IS_PRODUCTION === "true";
  return { secretKey, validationToken, isProduction };
}

function flipBaseUrl(isProduction: boolean) {
  return isProduction
    ? "https://bigflip.id/big_flip/api/v3"
    : "https://bigflip.id/big_flip_sandbox/api/v3";
}

function toFlipExpiredDate(hoursFromNow = 24) {
  const date = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export const flipProvider: PaymentProvider = {
  id: "FLIP",
  label: "Flip Business",
  isConfigured() {
    return Boolean(flipConfig().secretKey);
  },
  async createCheckout(input: CheckoutRequest): Promise<CheckoutResult> {
    const { secretKey, isProduction } = flipConfig();
    if (!secretKey) {
      throw new Error("Flip Business belum dikonfigurasi.");
    }

    // Accept Payment Create Bill (form-urlencoded is common for Flip PWF).
    const form = new URLSearchParams();
    form.set("title", input.itemName.slice(0, 50));
    form.set("amount", String(input.amountIdr));
    form.set("type", "SINGLE");
    form.set("expired_date", toFlipExpiredDate(24));
    form.set("redirect_url", input.returnUrl);
    form.set("reference_id", input.orderId);
    form.set("step", "checkout");

    const response = await fetch(`${flipBaseUrl(isProduction)}/pwf/bill`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: basicAuthHeader(secretKey),
      },
      body: form.toString(),
    });

    const payload = (await response.json()) as {
      id?: number | string;
      link_url?: string;
      status?: string;
      errors?: Array<{ message?: string }>;
      message?: string;
    };

    const checkoutUrl =
      payload.link_url || (payload as { link?: string }).link || "";

    if (!response.ok || !checkoutUrl) {
      throw new Error(
        payload.errors?.[0]?.message ||
          payload.message ||
          "Checkout Flip gagal dibuat.",
      );
    }

    return {
      provider: "FLIP",
      checkoutUrl,
      providerRef: String(payload.id ?? ""),
      raw: payload,
    };
  },
  async parseWebhook(
    body: unknown,
    headers: Headers,
  ): Promise<NormalizedPaymentEvent> {
    const { validationToken } = flipConfig();
    const tokenHeader =
      headers.get("x-callback-token") ||
      headers.get("X-Callback-Token") ||
      "";

    if (validationToken && tokenHeader && tokenHeader !== validationToken) {
      throw new Error("Token callback Flip tidak valid.");
    }

    const payload = body as {
      id?: number | string;
      bill_link_id?: number | string;
      bill_title?: string;
      amount?: number;
      status?: string;
      reference_id?: string;
      data?: {
        bill_link?: string;
        reference_id?: string;
        id?: number | string;
        status?: string;
        amount?: number;
      };
    };

    const orderId = String(
      payload.reference_id ||
        payload.data?.reference_id ||
        payload.bill_title ||
        "",
    );
    const statusRaw = String(
      payload.status || payload.data?.status || "",
    ).toUpperCase();

    if (!orderId) {
      throw new Error("Webhook Flip tanpa reference order.");
    }

    let status: NormalizedPaymentEvent["status"] = "PENDING";
    if (statusRaw === "SUCCESSFUL" || statusRaw === "SUCCESS" || statusRaw === "DONE") {
      status = "PAID";
    } else if (
      statusRaw === "FAILED" ||
      statusRaw === "CANCELLED" ||
      statusRaw === "CANCELED"
    ) {
      status = statusRaw.includes("CANCEL") ? "CANCELLED" : "FAILED";
    } else if (statusRaw === "EXPIRED") {
      status = "EXPIRED";
    }

    return {
      orderId,
      status,
      providerRef: String(payload.id || payload.data?.id || ""),
      amountIdr: Number(payload.amount || payload.data?.amount || 0) || undefined,
      raw: payload,
    };
  },
};
