import { downgradeQuality } from "./deviceCapability";
import type { QualityTier } from "./types";

/**
 * Pure mask math helpers. No DOM / MediaPipe — easy to unit test.
 */

export function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) {
    return x < edge0 ? 0 : 1;
  }
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Soft person threshold: values near mid-gray become soft alpha instead of binary cut.
 * Wider band keeps hair / shoulder edges from hard clipping.
 */
export function softThreshold(
  value: number,
  low = 0.22,
  high = 0.78,
): number {
  return smoothstep(low, high, value);
}

/**
 * Pull the soft edge inward so residual background / dark halo is less visible.
 * `amount` 0 = no change, ~0.12–0.2 is typical.
 */
export function chokeAlpha(
  alpha: Uint8ClampedArray,
  amount = 0.12,
): Uint8ClampedArray {
  const a = Math.min(0.4, Math.max(0, amount));
  if (a <= 0) {
    return alpha;
  }
  const inv = 1 / (1 - a);
  for (let i = 0; i < alpha.length; i += 1) {
    const t = alpha[i] / 255;
    const choked = Math.min(1, Math.max(0, (t - a) * inv));
    alpha[i] = Math.round(choked * 255);
  }
  return alpha;
}

/**
 * Temporal EMA: out = alpha * previous + (1 - alpha) * current
 * Higher alpha = smoother (more previous), default 0.78.
 */
export function temporalBlend(
  previous: number,
  current: number,
  alpha = 0.78,
): number {
  const a = Math.min(1, Math.max(0, alpha));
  return a * previous + (1 - a) * current;
}

export function ensureFloatBuffer(
  existing: Float32Array | null,
  length: number,
): Float32Array {
  if (existing && existing.length === length) {
    return existing;
  }
  return new Float32Array(length);
}

export function ensureUint8Buffer(
  existing: Uint8ClampedArray | null,
  length: number,
): Uint8ClampedArray {
  if (existing && existing.length === length) {
    return existing;
  }
  return new Uint8ClampedArray(length);
}

/**
 * Apply temporal smoothing + soft threshold into an alpha mask (0–255).
 * Reuses output buffer when possible.
 */
export function refineMaskToAlpha(
  raw: Float32Array,
  previous: Float32Array | null,
  alphaOut: Uint8ClampedArray | null,
  temporalAlpha: number,
): { previous: Float32Array; alpha: Uint8ClampedArray } {
  const length = raw.length;
  const prev = ensureFloatBuffer(previous, length);
  const alpha = ensureUint8Buffer(alphaOut, length);

  for (let i = 0; i < length; i += 1) {
    const blended = temporalBlend(prev[i] ?? raw[i], raw[i], temporalAlpha);
    prev[i] = blended;
    alpha[i] = Math.round(softThreshold(blended) * 255);
  }

  return { previous: prev, alpha };
}

/**
 * Box blur feather on alpha mask (in-place ping-pong with scratch).
 * radius ~3–6 px at inference resolution (edges are refined again after upsample).
 */
export function featherAlpha(
  alpha: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
  scratch: Uint8ClampedArray | null,
): Uint8ClampedArray {
  const r = Math.max(0, Math.min(12, Math.round(radius)));
  if (r === 0) {
    return alpha;
  }

  const scratchBuf = ensureUint8Buffer(scratch, alpha.length);
  const size = 2 * r + 1;

  // Horizontal
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let k = -r; k <= r; k += 1) {
        const xx = Math.min(width - 1, Math.max(0, x + k));
        sum += alpha[y * width + xx];
      }
      scratchBuf[y * width + x] = Math.round(sum / size);
    }
  }

  // Vertical
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let k = -r; k <= r; k += 1) {
        const yy = Math.min(height - 1, Math.max(0, y + k));
        sum += scratchBuf[yy * width + x];
      }
      alpha[y * width + x] = Math.round(sum / size);
    }
  }

  return alpha;
}

export type AdaptiveDowngradeInput = {
  quality: QualityTier;
  rollingInferenceMs: number;
  budgetMs: number;
  lastChangeAt: number;
  now: number;
  cooldownMs: number;
  autoMode: boolean;
};

export type AdaptiveDowngradeResult = {
  quality: QualityTier;
  changed: boolean;
  autoDowngraded: boolean;
  lastChangeAt: number;
};

export function maybeDowngradeQuality(
  input: AdaptiveDowngradeInput,
): AdaptiveDowngradeResult {
  if (!input.autoMode) {
    return {
      quality: input.quality,
      changed: false,
      autoDowngraded: false,
      lastChangeAt: input.lastChangeAt,
    };
  }

  if (input.now - input.lastChangeAt < input.cooldownMs) {
    return {
      quality: input.quality,
      changed: false,
      autoDowngraded: false,
      lastChangeAt: input.lastChangeAt,
    };
  }

  if (input.rollingInferenceMs <= input.budgetMs) {
    return {
      quality: input.quality,
      changed: false,
      autoDowngraded: false,
      lastChangeAt: input.lastChangeAt,
    };
  }

  const next = downgradeQuality(input.quality);
  if (!next) {
    return {
      quality: input.quality,
      changed: false,
      autoDowngraded: false,
      lastChangeAt: input.lastChangeAt,
    };
  }

  return {
    quality: next,
    changed: true,
    autoDowngraded: true,
    lastChangeAt: input.now,
  };
}

export function updateRollingAverage(
  previous: number,
  sample: number,
  weight = 0.2,
): number {
  if (previous <= 0) return sample;
  return previous * (1 - weight) + sample * weight;
}
