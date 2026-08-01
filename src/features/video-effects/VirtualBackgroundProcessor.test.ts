import { describe, expect, it, vi } from "vitest";
import { VirtualBackgroundProcessor } from "./VirtualBackgroundProcessor";

describe("VirtualBackgroundProcessor cleanup", () => {
  it("destroy is safe before init", async () => {
    const processor = new VirtualBackgroundProcessor();
    await expect(processor.destroy()).resolves.toBeUndefined();
    expect(processor.processedTrack).toBeUndefined();
  });

  it("setEffect none does not throw without pipeline", async () => {
    const processor = new VirtualBackgroundProcessor();
    await expect(
      processor.setEffect({ mode: "none", qualityMode: "auto" }),
    ).resolves.toBeUndefined();
  });

  it("effectIdToMode maps legacy ids", async () => {
    const { effectIdToMode } = await import("./VirtualBackgroundProcessor");
    expect(effectIdToMode("none").mode).toBe("none");
    expect(effectIdToMode("blur").mode).toBe("blur-light");
    expect(effectIdToMode("blur-strong").mode).toBe("blur-strong");
    expect(effectIdToMode("preset:office").mode).toBe("image");
  });

  it("reports default stats shape", () => {
    const onStats = vi.fn();
    const processor = new VirtualBackgroundProcessor({ onStats });
    const stats = processor.getStats();
    expect(stats.activeQuality).toBeTruthy();
    expect(stats.segmentationWidth).toBeGreaterThan(0);
    expect(stats.segmentationHeight).toBeGreaterThan(0);
  });
});
