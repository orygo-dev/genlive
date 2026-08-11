import {
  FilesetResolver,
  ImageSegmenter,
  type ImageSegmenterResult,
} from "@mediapipe/tasks-vision";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite";

const WASM_ROOT =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";

/** Keep MediaPipe warm across prejoin → room so join does not reload WASM/model. */
const IDLE_RELEASE_MS = 45_000;

let segmenterPromise: Promise<ImageSegmenter> | null = null;
let segmenterInstance: ImageSegmenter | null = null;
let refCount = 0;
let idleReleaseTimer: ReturnType<typeof setTimeout> | null = null;

function clearIdleReleaseTimer() {
  if (idleReleaseTimer != null) {
    clearTimeout(idleReleaseTimer);
    idleReleaseTimer = null;
  }
}

async function closeSegmenterInstance() {
  const instance = segmenterInstance;
  segmenterInstance = null;
  segmenterPromise = null;
  if (instance) {
    await instance.close();
  }
}

export async function acquireImageSegmenter(): Promise<ImageSegmenter> {
  refCount += 1;
  clearIdleReleaseTimer();
  if (segmenterInstance) {
    return segmenterInstance;
  }
  if (!segmenterPromise) {
    segmenterPromise = createSegmenter();
  }
  try {
    segmenterInstance = await segmenterPromise;
    return segmenterInstance;
  } catch (error) {
    segmenterPromise = null;
    refCount = Math.max(0, refCount - 1);
    throw error;
  }
}

export async function releaseImageSegmenter(): Promise<void> {
  refCount = Math.max(0, refCount - 1);
  if (refCount > 0) {
    return;
  }
  // Delay close so the in-room processor can reuse the warm segmenter.
  clearIdleReleaseTimer();
  idleReleaseTimer = setTimeout(() => {
    idleReleaseTimer = null;
    if (refCount > 0) return;
    void closeSegmenterInstance();
  }, IDLE_RELEASE_MS);
}

export function getImageSegmenterRefCount() {
  return refCount;
}

/** Test helper — force reset singleton without waiting for refCount. */
export async function resetImageSegmenterForTests() {
  refCount = 0;
  clearIdleReleaseTimer();
  await closeSegmenterInstance();
}

async function createSegmenter() {
  const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);
  return ImageSegmenter.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: MODEL_URL,
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    outputCategoryMask: true,
    // Continuous confidence yields smoother edges than a hard category cut.
    outputConfidenceMasks: true,
  });
}

/**
 * Fill `out` with person occupancy in [0, 1].
 * Prefers confidence masks; falls back to inverted category mask.
 *
 * NOTE: Do not auto-invert via center/border heuristics here — that false-fires
 * when the person is off-center, wears dark clothing, or fills most of the frame.
 * Empty-person fail-safe lives in VirtualBackgroundProcessor (multi-frame).
 */
export function fillPersonOccupancy(
  result: ImageSegmenterResult,
  out: Float32Array,
): boolean {
  const confMasks = result.confidenceMasks;
  if (confMasks && confMasks.length > 0) {
    // selfie_segmenter typically exposes [background, person]. Prefer person.
    const personMask = confMasks[confMasks.length > 1 ? confMasks.length - 1 : 0];
    const data = personMask.getAsFloat32Array();
    if (data.length === out.length) {
      for (let i = 0; i < data.length; i += 1) {
        out[i] = data[i];
      }
      return true;
    }
    // Size mismatch — fall through to category mask.
  }

  const category = result.categoryMask;
  if (!category) {
    return false;
  }
  const data = category.getAsFloat32Array();
  const length = Math.min(out.length, data.length);
  // selfie_segmenter category mask: 0 = person, >0 = background
  for (let i = 0; i < length; i += 1) {
    out[i] = data[i] < 0.5 ? 1 : 0;
  }
  return true;
}

/**
 * Diagnostic helper for tests — not used in the live processor path.
 * Kept exported so polarity experiments stay unit-testable without shipping
 * aggressive auto-invert in production.
 */
export function maybeInvertOccupancy(out: Float32Array): void {
  const n = out.length;
  if (n < 64) return;

  const width = Math.max(1, Math.round(Math.sqrt(n)));
  const height = Math.max(1, Math.floor(n / width));
  if (width * height > n) return;

  let centerSum = 0;
  let centerCount = 0;
  let borderSum = 0;
  let borderCount = 0;
  const x0 = Math.floor(width * 0.3);
  const x1 = Math.ceil(width * 0.7);
  const y0 = Math.floor(height * 0.25);
  const y1 = Math.ceil(height * 0.85);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const v = out[y * width + x];
      const inCenter = x >= x0 && x < x1 && y >= y0 && y < y1;
      if (inCenter) {
        centerSum += v;
        centerCount += 1;
      } else {
        borderSum += v;
        borderCount += 1;
      }
    }
  }

  if (!centerCount || !borderCount) return;
  const centerMean = centerSum / centerCount;
  const borderMean = borderSum / borderCount;

  if (borderMean > 0.55 && centerMean < 0.35 && borderMean - centerMean > 0.2) {
    for (let i = 0; i < n; i += 1) {
      out[i] = 1 - out[i];
    }
  }
}

export function segmentVideoFrame(
  segmenter: ImageSegmenter,
  source: HTMLVideoElement | HTMLCanvasElement,
  timestampMs: number,
): Promise<ImageSegmenterResult> {
  return new Promise((resolve, reject) => {
    try {
      segmenter.segmentForVideo(source, timestampMs, (result) => {
        resolve(result);
      });
    } catch (error) {
      reject(error);
    }
  });
}
