import { describe, expect, it } from "vitest";
import {
  amountsMatchIdr,
  verifyIpaymuNotifySignature,
} from "./webhook-security";
import { hmacSha256Hex } from "./types";

describe("webhook security", () => {
  it("verifies iPaymu notify signature with sorted payload", () => {
    const va = "1179000899";
    const payload: Record<string, unknown> = {
      trx_id: "123",
      status: "berhasil",
      amount: "149000",
      reference_id: "GM-TEST",
    };
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(payload).sort()) {
      sorted[key] = payload[key];
    }
    const signature = hmacSha256Hex(va, JSON.stringify(sorted));
    expect(
      verifyIpaymuNotifySignature({ ...payload, signature }, va),
    ).toBe(true);
    expect(
      verifyIpaymuNotifySignature({ ...payload, signature: "deadbeef" }, va),
    ).toBe(false);
  });

  it("matches amounts within IDR tolerance", () => {
    expect(amountsMatchIdr(149000, 149000)).toBe(true);
    expect(amountsMatchIdr(149000, 149001)).toBe(true);
    expect(amountsMatchIdr(149000, 148000)).toBe(false);
    expect(amountsMatchIdr(149000, undefined)).toBe(false);
  });
});
