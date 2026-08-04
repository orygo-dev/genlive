import { describe, expect, it } from "vitest";
import {
  maybeDowngradeQuality,
  chokeAlpha,
  refineMaskToAlpha,
  smoothstep,
  softThreshold,
  temporalBlend,
  updateRollingAverage,
} from "./maskSmoothing";
import {
  selectDeviceQuality,
  targetFpsForQuality,
} from "./deviceCapability";
import { ADAPTIVE_COOLDOWN_MS } from "./types";
import { getImageSegmenterRefCount } from "./imageSegmenter";

describe("maskSmoothing", () => {
  it("uses the raw mask on the first frame instead of blending with zero", () => {
    const raw = new Float32Array([1, 0.8, 0.2, 0]);
    const result = refineMaskToAlpha(raw, null, null, 0.72);

    expect(Array.from(result.previous)).toEqual(Array.from(raw));
    expect(result.alpha[0]).toBe(255);
    expect(result.alpha[3]).toBe(0);
  });

  it("reacts quickly at moving edges", () => {
    const result = refineMaskToAlpha(
      new Float32Array([1]),
      new Float32Array([0]),
      null,
      0.72,
    );

    expect(result.previous[0]).toBeGreaterThan(0.75);
  });

  it("smoothstep clamps and eases", () => {
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 2)).toBe(1);
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5, 5);
    expect(smoothstep(0.2, 0.8, 0.2)).toBe(0);
    expect(smoothstep(0.2, 0.8, 0.8)).toBe(1);
  });

  it("softThreshold uses smoothstep band", () => {
    expect(softThreshold(0)).toBe(0);
    expect(softThreshold(1)).toBe(1);
    expect(softThreshold(0.5)).toBeGreaterThan(0);
    expect(softThreshold(0.5)).toBeLessThan(1);
  });

  it("chokeAlpha pulls soft edge inward", () => {
    const alpha = new Uint8ClampedArray([0, 64, 128, 192, 255]);
    chokeAlpha(alpha, 0.25);
    expect(alpha[0]).toBe(0);
    expect(alpha[4]).toBe(255);
    expect(alpha[2]).toBeLessThan(128);
  });

  it("temporalBlend favors previous at alpha 0.78", () => {
    const blended = temporalBlend(1, 0, 0.78);
    expect(blended).toBeCloseTo(0.78, 5);
    expect(temporalBlend(0.5, 0.5, 0.78)).toBeCloseTo(0.5, 5);
  });
});

describe("deviceCapability", () => {
  it("selects low for weak devices", () => {
    expect(
      selectDeviceQuality({
        hardwareConcurrency: 2,
        deviceMemoryGb: 2,
        hasWebGl2: true,
        hasModernTrackProcessor: false,
      }),
    ).toBe("low");
  });

  it("selects balanced for mid devices", () => {
    expect(
      selectDeviceQuality({
        hardwareConcurrency: 4,
        deviceMemoryGb: 4,
        hasWebGl2: true,
        hasModernTrackProcessor: false,
      }),
    ).toBe("balanced");
  });

  it("selects high for capable devices", () => {
    expect(
      selectDeviceQuality({
        hardwareConcurrency: 8,
        deviceMemoryGb: 8,
        hasWebGl2: true,
        hasModernTrackProcessor: true,
      }),
    ).toBe("high");
  });

  it("maps quality to target fps ranges", () => {
    expect(targetFpsForQuality("low")).toBeGreaterThanOrEqual(12);
    expect(targetFpsForQuality("low")).toBeLessThanOrEqual(15);
    expect(targetFpsForQuality("balanced")).toBeGreaterThanOrEqual(18);
    expect(targetFpsForQuality("high")).toBeGreaterThanOrEqual(24);
  });
});

describe("adaptive quality downgrade", () => {
  it("does not change outside auto mode", () => {
    const result = maybeDowngradeQuality({
      quality: "high",
      rollingInferenceMs: 100,
      budgetMs: 18,
      lastChangeAt: 0,
      now: 10_000,
      cooldownMs: ADAPTIVE_COOLDOWN_MS,
      autoMode: false,
    });
    expect(result.changed).toBe(false);
    expect(result.quality).toBe("high");
  });

  it("respects cooldown", () => {
    const result = maybeDowngradeQuality({
      quality: "high",
      rollingInferenceMs: 100,
      budgetMs: 18,
      lastChangeAt: 8_000,
      now: 10_000,
      cooldownMs: ADAPTIVE_COOLDOWN_MS,
      autoMode: true,
    });
    expect(result.changed).toBe(false);
  });

  it("downgrades after cooldown when over budget", () => {
    const result = maybeDowngradeQuality({
      quality: "high",
      rollingInferenceMs: 40,
      budgetMs: 18,
      lastChangeAt: 0,
      now: 6_000,
      cooldownMs: ADAPTIVE_COOLDOWN_MS,
      autoMode: true,
    });
    expect(result.changed).toBe(true);
    expect(result.quality).toBe("balanced");
    expect(result.autoDowngraded).toBe(true);
    expect(result.lastChangeAt).toBe(6_000);
  });

  it("stops at low", () => {
    const result = maybeDowngradeQuality({
      quality: "low",
      rollingInferenceMs: 100,
      budgetMs: 18,
      lastChangeAt: 0,
      now: 10_000,
      cooldownMs: ADAPTIVE_COOLDOWN_MS,
      autoMode: true,
    });
    expect(result.changed).toBe(false);
    expect(result.quality).toBe("low");
  });

  it("updates rolling average", () => {
    expect(updateRollingAverage(0, 20)).toBe(20);
    expect(updateRollingAverage(20, 40, 0.5)).toBe(30);
  });
});

describe("imageSegmenter cleanup refcount", () => {
  it("starts at zero refs", () => {
    expect(getImageSegmenterRefCount()).toBe(0);
  });
});
