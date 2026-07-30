export type EmailDelivery = "email" | "manual_link" | "email_failed";

export type EmailMessage = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
};

export type SendEmailResult =
  | { ok: true; delivery: "email"; id?: string }
  | { ok: false; delivery: "manual_link" | "email_failed"; error?: string };

export function isEmailConfigured() {
  return Boolean(
    process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim(),
  );
}

export async function sendEmail(message: EmailMessage): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();

  if (!apiKey || !from) {
    return {
      ok: false,
      delivery: "manual_link",
      error: "Email belum dikonfigurasi.",
    };
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });

    if (result.error) {
      console.error("Email send failed", result.error);
      return {
        ok: false,
        delivery: "email_failed",
        error: result.error.message,
      };
    }

    return {
      ok: true,
      delivery: "email",
      id: result.data?.id,
    };
  } catch (error) {
    console.error("Email send failed", error);
    return {
      ok: false,
      delivery: "email_failed",
      error: error instanceof Error ? error.message : "Gagal mengirim email.",
    };
  }
}

export function summarizeDeliveries(
  results: SendEmailResult[],
): EmailDelivery {
  if (results.length === 0) {
    return "manual_link";
  }

  if (results.every((result) => result.delivery === "email")) {
    return "email";
  }

  if (results.every((result) => result.delivery === "manual_link")) {
    return "manual_link";
  }

  if (results.some((result) => result.delivery === "email")) {
    return "email";
  }

  return "email_failed";
}
