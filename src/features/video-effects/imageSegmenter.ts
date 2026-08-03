import {
  FilesetResolver,
  ImageSegmenter,
  type ImageSegmenterResult,
} from "@mediapipe/tasks-vision";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite";

const WASM_ROOT =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";

let segmenterPromise: Promise<ImageSegmenter> | null = null;
let segmenterInstance: ImageSegmenter | null = null;
let refCount = 0;

export async function acquireImageSegmenter(): Promise<ImageSegmenter> {
  refCount += 1;
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
  const instance = segmenterInstance;
  segmenterInstance = null;
  segmenterPromise = null;
  if (instance) {
    await instance.close();
  }
}

export function getImageSegmenterRefCount() {
  return refCount;
}

/** Test helper — force reset singleton without waiting for refCount. */
export async function resetImageSegmenterForTests() {
  refCount = 0;
  const instance = segmenterInstance;
  segmenterInstance = null;
  segmenterPromise = null;
  if (instance) {
    await instance.close();
  }
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
 */
export function fillPersonOccupancy(
  result: ImageSegmenterResult,
  out: Float32Array,
  width: number,
  height: number,
): boolean {
  const confMasks = result.confidenceMasks;
  if (confMasks && confMasks.length > 0) {
    // selfie_segmenter: usually [background, person] — prefer last mask.
    const personMask = confMasks[confMasks.length > 1 ? confMasks.length - 1 : 0];
    const data = personMask.getAsFloat32Array();
    if (data.length === out.length) {
      const invert = shouldInvertConfidence(data, width, height);
      for (let i = 0; i < data.length; i += 1) {
        const v = data[i];
        out[i] = invert ? 1 - v : v;
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

/** Center region should be person → mean high if mask encodes person confidence. */
function shouldInvertConfidence(
  data: Float32Array,
  width: number,
  height: number,
): boolean {
  if (width <= 0 || height <= 0 || data.length < width * height) {
    return false;
  }
  const x0 = Math.floor(width * 0.35);
  const x1 = Math.max(x0 + 1, Math.floor(width * 0.65));
  const y0 = Math.floor(height * 0.2);
  const y1 = Math.max(y0 + 1, Math.floor(height * 0.7));
  let sum = 0;
  let count = 0;
  for (let y = y0; y < y1; y += 1) {
    const row = y * width;
    for (let x = x0; x < x1; x += 1) {
      sum += data[row + x];
      count += 1;
    }
  }
  return count > 0 && sum / count < 0.45;
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
