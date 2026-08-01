import { describe, expect, it } from "vitest";
import {
  getPresetImagePath,
  isBackgroundEffectId,
} from "./background-effects";
import { toProcessorSwitchOptions } from "./background-processor";

describe("background effects", () => {
  it("validates effect ids", () => {
    expect(isBackgroundEffectId("none")).toBe(true);
    expect(isBackgroundEffectId("blur")).toBe(true);
    expect(isBackgroundEffectId("blur-strong")).toBe(true);
    expect(isBackgroundEffectId("preset:soft-blue")).toBe(true);
    expect(isBackgroundEffectId("preset:missing")).toBe(false);
    expect(isBackgroundEffectId("glow")).toBe(false);
  });

  it("maps effects to processor options", () => {
    expect(toProcessorSwitchOptions("none")).toEqual({ mode: "disabled" });
    expect(toProcessorSwitchOptions("blur")).toEqual({
      mode: "background-blur",
      blurRadius: 12,
    });
    expect(toProcessorSwitchOptions("blur-strong")).toEqual({
      mode: "background-blur",
      blurRadius: 24,
    });
    expect(toProcessorSwitchOptions("preset:soft-blue")).toEqual({
      mode: "virtual-background",
      imagePath: "/backgrounds/soft-blue.svg",
    });
    expect(getPresetImagePath("preset:office")).toBe("/backgrounds/office.svg");
  });
});
