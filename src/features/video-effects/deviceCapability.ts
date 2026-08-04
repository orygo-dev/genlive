import type { QualityTier } from "./types";
import { SEGMENTATION_FPS } from "./types";

export type DeviceCapabilityHints = {
  hardwareConcurrency?: number;
  deviceMemoryGb?: number;
  hasWebGl2?: boolean;
  hasModernTrackProcessor?: boolean;
};

export function detectDeviceCapabilityHints(): DeviceCapabilityHints {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {};
  }

  let hasWebGl2 = false;
  try {
    const canvas = document.createElement("canvas");
    hasWebGl2 = Boolean(canvas.getContext("webgl2"));
  } catch {
    hasWebGl2 = false;
  }

  const nav = navigator as Navigator & { deviceMemory?: number };

  return {
    hardwareConcurrency: navigator.hardwareConcurrency || undefined,
    deviceMemoryGb: nav.deviceMemory,
    hasWebGl2,
    hasModernTrackProcessor:
      typeof MediaStreamTrackProcessor !== "undefined" &&
      typeof MediaStreamTrackGenerator !== "undefined",
  };
}

/**
 * Pick a starting quality tier from device hints.
 * Conservative on low-end so edges stay smoother than over-committed high FPS.
 */
export function selectDeviceQuality(
  hints: DeviceCapabilityHints = detectDeviceCapabilityHints(),
): QualityTier {
  const cores = hints.hardwareConcurrency ?? 4;
  const memory = hints.deviceMemoryGb ?? 4;
  const modern = hints.hasModernTrackProcessor ?? false;
  const webgl = hints.hasWebGl2 ?? false;

  if (!webgl || cores <= 2 || memory <= 2) {
    return "low";
  }
  if (!modern || cores <= 4 || memory <= 4) {
    return "balanced";
  }
  // MediaPipe and canvas compositing still share the browser main thread.
  // Keep automatic mode responsive; High remains available as an opt-in.
  return "balanced";
}

export function targetFpsForQuality(quality: QualityTier): number {
  const range = SEGMENTATION_FPS[quality];
  return Math.round((range.min + range.max) / 2);
}

export function downgradeQuality(current: QualityTier): QualityTier | null {
  if (current === "high") return "balanced";
  if (current === "balanced") return "low";
  return null;
}

export function supportsVideoEffects(): boolean {
  if (typeof window === "undefined") return false;
  const hints = detectDeviceCapabilityHints();
  return Boolean(
    hints.hasWebGl2 &&
      typeof HTMLCanvasElement !== "undefined" &&
      typeof createImageBitmap !== "undefined" &&
      "captureStream" in HTMLCanvasElement.prototype,
  );
}
