import {
  BackgroundProcessor,
  supportsModernBackgroundProcessors,
  type BackgroundProcessorWrapper,
  type SwitchBackgroundProcessorOptions,
} from "@livekit/track-processors";
import type { LocalVideoTrack } from "livekit-client";
import {
  getBackgroundImagePath,
  isVirtualBackgroundEffect,
  type BackgroundEffectId,
} from "@/lib/background-effects";

const rasterCache = new Map<string, string>();

export function createDisabledBackgroundProcessor() {
  return BackgroundProcessor(
    {
      mode: "disabled",
      segmenterOptions: {
        delegate: "GPU",
      },
      // Slightly lower FPS keeps edges steadier under CPU load.
      maxFps: supportsModernBackgroundProcessors() ? 24 : 20,
    },
    "genmeet-background",
  );
}

export function toProcessorSwitchOptions(
  effectId: BackgroundEffectId,
): SwitchBackgroundProcessorOptions {
  if (effectId === "none") {
    return { mode: "disabled" };
  }
  if (effectId === "blur") {
    return { mode: "background-blur", blurRadius: 16 };
  }
  if (effectId === "blur-strong") {
    return { mode: "background-blur", blurRadius: 28 };
  }

  const imagePath = getBackgroundImagePath(effectId);
  if (!imagePath) {
    return { mode: "disabled" };
  }
  return { mode: "virtual-background", imagePath };
}

export { isVirtualBackgroundEffect };

/**
 * LiveKit WebGL compositing often fails on SVG (black / empty texture).
 * Rasterize to JPEG data-URL so virtual backgrounds stay visible.
 */
export async function rasterizeBackgroundImage(src: string): Promise<string> {
  if (
    src.startsWith("data:image/jpeg") ||
    src.startsWith("data:image/jpg") ||
    src.startsWith("data:image/png") ||
    src.startsWith("data:image/webp")
  ) {
    return src;
  }

  const cached = rasterCache.get(src);
  if (cached) {
    return cached;
  }

  const image = await loadImage(src);
  const width = Math.max(1, image.naturalWidth || image.width || 1280);
  const height = Math.max(1, image.naturalHeight || image.height || 720);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas tidak tersedia untuk background.");
  }
  context.drawImage(image, 0, 0, width, height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  rasterCache.set(src, dataUrl);
  return dataUrl;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    if (!src.startsWith("data:")) {
      image.crossOrigin = "anonymous";
    }
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("Gambar background gagal dimuat."));
    image.src = src;
  });
}

export async function resolveProcessorSwitchOptions(
  effectId: BackgroundEffectId,
): Promise<SwitchBackgroundProcessorOptions> {
  if (!isVirtualBackgroundEffect(effectId)) {
    return toProcessorSwitchOptions(effectId);
  }

  const imagePath = getBackgroundImagePath(effectId);
  if (!imagePath) {
    return { mode: "disabled" };
  }

  const rasterPath = await rasterizeBackgroundImage(imagePath);
  return { mode: "virtual-background", imagePath: rasterPath };
}

/**
 * Apply effect. Do NOT restart the camera track here — restartTrack while a
 * processor is attached commonly blacks out the preview (especially pre-join).
 */
export async function applyBackgroundEffect(
  processor: BackgroundProcessorWrapper,
  effectId: BackgroundEffectId,
  _track?: LocalVideoTrack | null,
) {
  await processor.switchTo(await resolveProcessorSwitchOptions(effectId));
}
