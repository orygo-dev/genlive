import { z } from "zod";

/** Normalize Indonesian / E.164-ish phone numbers for Fonnte (default country 62). */
export function normalizePhoneNumber(raw: string, defaultCountry = "62") {
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) {
    digits = digits.slice(1);
  }
  digits = digits.replace(/\D/g, "");

  if (!digits) {
    return null;
  }

  if (digits.startsWith("0") && defaultCountry) {
    digits = `${defaultCountry}${digits.slice(1)}`;
  } else if (
    defaultCountry &&
    !digits.startsWith(defaultCountry) &&
    digits.length <= 11
  ) {
    // Local mobile without leading 0, e.g. 812...
    digits = `${defaultCountry}${digits}`;
  }

  if (digits.length < 10 || digits.length > 15) {
    return null;
  }

  return digits;
}

export function parseInvitePhones(value: unknown, max = 20) {
  const raw =
    typeof value === "string"
      ? value.split(/[,;\s]+/)
      : Array.isArray(value)
        ? value
        : [];

  const phones = raw
    .map((item) => normalizePhoneNumber(String(item).trim()))
    .filter((item): item is string => Boolean(item));

  return [...new Set(phones)].slice(0, max);
}

export function isValidInvitePhone(phone: string) {
  return z
    .string()
    .regex(/^\d{10,15}$/)
    .safeParse(phone).success;
}
