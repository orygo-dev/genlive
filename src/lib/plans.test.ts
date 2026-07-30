import { describe, expect, it } from "vitest";
import { formatIdr, getPlan, PLANS } from "./plans";
import { createMerchantOrderId, sha512Hex } from "./payments/types";

describe("plans", () => {
  it("returns free plan by default", () => {
    expect(getPlan("UNKNOWN").code).toBe("FREE");
    expect(PLANS.PRO.priceIdr).toBeGreaterThan(0);
  });

  it("formats IDR currency", () => {
    expect(formatIdr(149000)).toContain("149");
  });
});

describe("payment helpers", () => {
  it("creates unique merchant order ids", () => {
    const first = createMerchantOrderId("GM");
    const second = createMerchantOrderId("GM");
    expect(first).not.toBe(second);
    expect(first.startsWith("GM-")).toBe(true);
  });

  it("hashes midtrans signature material", () => {
    expect(sha512Hex("abc")).toHaveLength(128);
  });
});
