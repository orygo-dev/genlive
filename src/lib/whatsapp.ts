export type WhatsAppDelivery = "whatsapp" | "manual_link" | "whatsapp_failed";

export type SendWhatsAppResult =
  | { ok: true; delivery: "whatsapp"; id?: string }
  | { ok: false; delivery: "manual_link" | "whatsapp_failed"; error?: string };

export function isWhatsAppConfigured() {
  return Boolean(process.env.FONNTE_TOKEN?.trim());
}

export async function sendWhatsAppMessage(input: {
  target: string;
  message: string;
  scheduleUnix?: number;
}): Promise<SendWhatsAppResult> {
  const token = process.env.FONNTE_TOKEN?.trim();
  if (!token) {
    return {
      ok: false,
      delivery: "manual_link",
      error: "WhatsApp (Fonnte) belum dikonfigurasi.",
    };
  }

  try {
    const countryCode = process.env.FONNTE_COUNTRY_CODE?.trim() || "62";
    const body = new URLSearchParams();
    body.set("target", input.target);
    body.set("message", input.message);
    body.set("countryCode", countryCode);
    body.set("preview", "false");
    if (input.scheduleUnix && input.scheduleUnix > 0) {
      body.set("schedule", String(input.scheduleUnix));
    }

    const response = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: {
        Authorization: token,
      },
      body,
    });

    const payload = (await response.json()) as {
      status?: boolean;
      detail?: string;
      reason?: string;
      id?: string[] | string;
    };

    if (!response.ok || payload.status === false) {
      const error =
        payload.reason || payload.detail || `HTTP ${response.status}`;
      console.error("Fonnte send failed", payload);
      return {
        ok: false,
        delivery: "whatsapp_failed",
        error,
      };
    }

    const id = Array.isArray(payload.id) ? payload.id[0] : payload.id;
    return {
      ok: true,
      delivery: "whatsapp",
      id: id ? String(id) : undefined,
    };
  } catch (error) {
    console.error("Fonnte send failed", error);
    return {
      ok: false,
      delivery: "whatsapp_failed",
      error:
        error instanceof Error ? error.message : "Gagal mengirim WhatsApp.",
    };
  }
}

export function summarizeWhatsAppDeliveries(
  results: SendWhatsAppResult[],
): WhatsAppDelivery {
  if (results.length === 0) {
    return "manual_link";
  }
  if (results.every((result) => result.delivery === "whatsapp")) {
    return "whatsapp";
  }
  if (results.every((result) => result.delivery === "manual_link")) {
    return "manual_link";
  }
  if (results.some((result) => result.delivery === "whatsapp")) {
    return "whatsapp";
  }
  return "whatsapp_failed";
}
