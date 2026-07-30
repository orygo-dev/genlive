import {
  basicAuthHeader,
  sha512Hex,
  type CheckoutRequest,
  type CheckoutResult,
  type NormalizedPaymentEvent,
  type PaymentProvider,
} from "@/lib/payments/types";

function midtransConfig() {
  const serverKey = process.env.MIDTRANS_SERVER_KEY?.trim();
  const clientKey = process.env.MIDTRANS_CLIENT_KEY?.trim();
  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";
  return { serverKey, clientKey, isProduction };
}

export const midtransProvider: PaymentProvider = {
  id: "MIDTRANS",
  label: "Midtrans",
  isConfigured() {
    const { serverKey, clientKey } = midtransConfig();
    return Boolean(serverKey && clientKey);
  },
  async createCheckout(input: CheckoutRequest): Promise<CheckoutResult> {
    const { serverKey, isProduction } = midtransConfig();
    if (!serverKey) {
      throw new Error("Midtrans belum dikonfigurasi.");
    }

    const endpoint = isProduction
      ? "https://app.midtrans.com/snap/v1/transactions"
      : "https://app.sandbox.midtrans.com/snap/v1/transactions";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: basicAuthHeader(serverKey),
        "X-Override-Notification": input.notifyUrl,
      },
      body: JSON.stringify({
        transaction_details: {
          order_id: input.orderId,
          gross_amount: input.amountIdr,
        },
        item_details: [
          {
            id: "plan-pro",
            price: input.amountIdr,
            quantity: 1,
            name: input.itemName.slice(0, 50),
          },
        ],
        customer_details: {
          first_name: input.customer.name.slice(0, 50),
          email: input.customer.email,
          phone: input.customer.phone,
        },
        callbacks: {
          finish: input.returnUrl,
          error: input.cancelUrl,
          pending: input.returnUrl,
        },
      }),
    });

    const payload = (await response.json()) as {
      token?: string;
      redirect_url?: string;
      error_messages?: string[];
      status_message?: string;
    };

    if (!response.ok || !payload.redirect_url) {
      throw new Error(
        payload.error_messages?.[0] ||
          payload.status_message ||
          "Checkout Midtrans gagal dibuat.",
      );
    }

    return {
      provider: "MIDTRANS",
      checkoutUrl: payload.redirect_url,
      providerRef: payload.token,
      raw: payload,
    };
  },
  async parseWebhook(body: unknown): Promise<NormalizedPaymentEvent> {
    const { serverKey } = midtransConfig();
    if (!serverKey) {
      throw new Error("Midtrans belum dikonfigurasi.");
    }

    const payload = body as {
      order_id?: string;
      status_code?: string;
      gross_amount?: string;
      signature_key?: string;
      transaction_status?: string;
      fraud_status?: string;
      transaction_id?: string;
    };

    if (
      !payload.order_id ||
      !payload.status_code ||
      !payload.gross_amount ||
      !payload.signature_key
    ) {
      throw new Error("Payload webhook Midtrans tidak lengkap.");
    }

    const expected = sha512Hex(
      `${payload.order_id}${payload.status_code}${payload.gross_amount}${serverKey}`,
    );
    if (expected !== payload.signature_key) {
      throw new Error("Signature Midtrans tidak valid.");
    }

    const transactionStatus = payload.transaction_status ?? "";
    const fraudStatus = payload.fraud_status ?? "accept";
    let status: NormalizedPaymentEvent["status"] = "PENDING";

    if (
      (transactionStatus === "capture" && fraudStatus === "accept") ||
      transactionStatus === "settlement"
    ) {
      status = "PAID";
    } else if (
      transactionStatus === "deny" ||
      transactionStatus === "cancel" ||
      transactionStatus === "failure"
    ) {
      status = "FAILED";
    } else if (transactionStatus === "expire") {
      status = "EXPIRED";
    }

    return {
      orderId: payload.order_id,
      status,
      providerRef: payload.transaction_id,
      amountIdr: Number.parseInt(payload.gross_amount, 10) || undefined,
      raw: payload,
    };
  },
};
