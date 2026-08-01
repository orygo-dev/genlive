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
    outputConfidenceMasks: false,
  });
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
