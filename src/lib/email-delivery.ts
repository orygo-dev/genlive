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
