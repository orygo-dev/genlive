import { describe, expect, it, vi } from "vitest";
import {
  loadBackgroundBitmap,
  rasterizeToJpegDataUrl,
} from "./backgroundLoader";
import {
  VirtualBackgroundProcessor,
  calculateCoverCrop,
} from "./VirtualBackgroundProcessor";

vi.mock("./backgroundLoader", () => ({
  drawImageCover: vi.fn(),
  loadBackgroundBitmap: vi.fn(),
  rasterizeToJpegDataUrl: vi.fn(),
}));

describe("VirtualBackgroundProcessor cleanup", () => {
  it("calculates a centered cover crop without stretching the camera", () => {
    expect(calculateCoverCrop(1920, 1080, 1280, 720)).toEqual({
      sourceX: 0,
      sourceY: 0,
      sourceWidth: 1920,
      sourceHeight: 1080,
    });
    expect(calculateCoverCrop(640, 480, 1280, 720)).toEqual({
      sourceX: 0,
      sourceY: 60,
      sourceWidth: 640,
      sourceHeight: 360,
    });
  });

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

  it("keeps the latest background when image loads finish out of order", async () => {
    let resolveFirst: ((bitmap: ImageBitmap) => void) | undefined;
    const firstBitmap = { width: 1280, height: 720 } as ImageBitmap;
    const secondBitmap = { width: 1280, height: 720 } as ImageBitmap;

    vi.mocked(rasterizeToJpegDataUrl).mockImplementation(async (src) => src);
    vi.mocked(loadBackgroundBitmap).mockImplementation((src) => {
      if (src === "first") {
        return new Promise<ImageBitmap>((resolve) => {
          resolveFirst = resolve;
        });
      }
      return Promise.resolve(secondBitmap);
    });

    const processor = new VirtualBackgroundProcessor();
    const first = processor.setEffect({
      mode: "image",
      imagePath: "first",
      qualityMode: "auto",
    });
    await vi.waitFor(() => {
      expect(loadBackgroundBitmap).toHaveBeenCalledWith("first");
    });

    await processor.setEffect({
      mode: "image",
      imagePath: "second",
      qualityMode: "auto",
    });
    resolveFirst?.(firstBitmap);
    await first;

    const state = processor as unknown as {
      imagePath: string | null;
      backgroundBitmap: ImageBitmap | null;
    };
    expect(state.imagePath).toBe("second");
    expect(state.backgroundBitmap).toBe(secondBitmap);
  });
});
