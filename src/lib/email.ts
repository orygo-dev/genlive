import { getPlatformConfig } from "@/lib/platform-config";
import {
  summarizeDeliveries,
  type EmailDelivery,
  type EmailMessage,
  type SendEmailResult,
} from "@/lib/email-delivery";

export type { EmailDelivery, EmailMessage, SendEmailResult };
export { summarizeDeliveries };

export async function isEmailConfigured() {
  const config = await getPlatformConfig();
  return Boolean(config.resendApiKey && config.emailFrom);
}

export async function sendEmail(message: EmailMessage): Promise<SendEmailResult> {
  const config = await getPlatformConfig();
  const apiKey = config.resendApiKey;
  const from = config.emailFrom;

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

