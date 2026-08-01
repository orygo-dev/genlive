const bitmapCache = new Map<string, ImageBitmap>();

export async function loadBackgroundBitmap(src: string): Promise<ImageBitmap> {
  const cached = bitmapCache.get(src);
  if (cached) {
    return cached;
  }

  const image = await loadHtmlImage(src);
  const bitmap = await createImageBitmap(image);
  bitmapCache.set(src, bitmap);
  return bitmap;
}

export function clearBackgroundCache() {
  for (const bitmap of bitmapCache.values()) {
    bitmap.close();
  }
  bitmapCache.clear();
}

export function evictBackgroundCacheEntry(src: string) {
  const bitmap = bitmapCache.get(src);
  if (bitmap) {
    bitmap.close();
    bitmapCache.delete(src);
  }
}

/**
 * Draw image with object-fit: cover into the destination rect.
 */
export function drawImageCover(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  image: CanvasImageSource,
  destWidth: number,
  destHeight: number,
) {
  const sourceWidth = getSourceWidth(image, destWidth);
  const sourceHeight = getSourceHeight(image, destHeight);

  const scale = Math.max(destWidth / sourceWidth, destHeight / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const dx = (destWidth - drawWidth) / 2;
  const dy = (destHeight - drawHeight) / 2;
  ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
}

function getSourceWidth(image: CanvasImageSource, fallback: number): number {
  if (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap) {
    return image.width || fallback;
  }
  if (typeof HTMLVideoElement !== "undefined" && image instanceof HTMLVideoElement) {
    return image.videoWidth || image.width || fallback;
  }
  if (typeof HTMLImageElement !== "undefined" && image instanceof HTMLImageElement) {
    return image.naturalWidth || image.width || fallback;
  }
  if (typeof HTMLCanvasElement !== "undefined" && image instanceof HTMLCanvasElement) {
    return image.width || fallback;
  }
  return fallback;
}

function getSourceHeight(image: CanvasImageSource, fallback: number): number {
  if (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap) {
    return image.height || fallback;
  }
  if (typeof HTMLVideoElement !== "undefined" && image instanceof HTMLVideoElement) {
    return image.videoHeight || image.height || fallback;
  }
  if (typeof HTMLImageElement !== "undefined" && image instanceof HTMLImageElement) {
    return image.naturalHeight || image.height || fallback;
  }
  if (typeof HTMLCanvasElement !== "undefined" && image instanceof HTMLCanvasElement) {
    return image.height || fallback;
  }
  return fallback;
}

function loadHtmlImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    if (!src.startsWith("data:")) {
      image.crossOrigin = "anonymous";
    }
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Background image failed to load"));
    image.src = src;
  });
}

/**
 * Rasterize SVG (or any URL) once to a JPEG data URL for WebGL/canvas reliability.
 */
export async function rasterizeToJpegDataUrl(src: string): Promise<string> {
  if (
    src.startsWith("data:image/jpeg") ||
    src.startsWith("data:image/jpg") ||
    src.startsWith("data:image/png") ||
    src.startsWith("data:image/webp")
  ) {
    return src;
  }

  const image = await loadHtmlImage(src);
  const width = Math.max(1, image.naturalWidth || image.width || 1280);
  const height = Math.max(1, image.naturalHeight || image.height || 720);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas unavailable for background rasterize");
  }
  ctx.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.92);
}
