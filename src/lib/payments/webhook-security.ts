import { timingSafeEqual } from "node:crypto";
import { hmacSha256Hex } from "@/lib/payments/types";

/** Compare hex digests without leaking timing. */
export function safeEqualHex(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * iPaymu notify signature:
 * HMAC-SHA256(JSON(sortedPayloadWithoutSignature), merchantVA)
 */
export function verifyIpaymuNotifySignature(
  payload: Record<string, unknown>,
  merchantVa: string,
): boolean {
  const received = String(payload.signature ?? payload.Signature ?? "").trim();
  if (!received || !merchantVa) return false;

  const data: Record<string, unknown> = { ...payload };
  delete data.signature;
  delete data.Signature;

  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(data).sort()) {
    sorted[key] = data[key];
  }

  const jsonBody = JSON.stringify(sorted);
  const calculated = hmacSha256Hex(merchantVa, jsonBody);
  return safeEqualHex(calculated.toLowerCase(), received.toLowerCase());
}

/** Allow small gateway rounding differences (IDR). */
export function amountsMatchIdr(
  expected: number,
  reported: number | undefined,
  tolerance = 1,
) {
  if (reported == null || !Number.isFinite(reported) || reported <= 0) {
    return false;
  }
  return Math.abs(Math.round(expected) - Math.round(reported)) <= tolerance;
}
