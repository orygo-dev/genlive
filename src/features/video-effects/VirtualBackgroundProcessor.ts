import {
  Track,
  type TrackProcessor,
  type VideoProcessorOptions,
} from "livekit-client";
import {
  drawImageCover,
  loadBackgroundBitmap,
  rasterizeToJpegDataUrl,
} from "./backgroundLoader";
import {
  selectDeviceQuality,
  targetFpsForQuality,
} from "./deviceCapability";
import {
  acquireImageSegmenter,
  releaseImageSegmenter,
  segmentVideoFrame,
} from "./imageSegmenter";
import {
  featherAlpha,
  maybeDowngradeQuality,
  refineMaskToAlpha,
  updateRollingAverage,
} from "./maskSmoothing";
import {
  ADAPTIVE_COOLDOWN_MS,
  ADAPTIVE_INFERENCE_BUDGET_MS,
  DEFAULT_FEATHER_PX,
  DEFAULT_TEMPORAL_ALPHA,
  INFERENCE_RESOLUTIONS,
  OUTPUT_HEIGHT,
  OUTPUT_WIDTH,
  type ProcessorStats,
  type QualityMode,
  type QualityTier,
  type VideoEffectMode,
  type VirtualBackgroundEffectConfig,
} from "./types";
import { videoEffectsLog } from "./videoEffectsLog";
import type { ImageSegmenter } from "@mediapipe/tasks-vision";

export type VirtualBackgroundProcessorOptions = {
  onStats?: (stats: ProcessorStats) => void;
  onAutoDowngrade?: (quality: QualityTier) => void;
};

export class VirtualBackgroundProcessor
  implements TrackProcessor<Track.Kind.Video>
{
  readonly name = "genmeet-virtual-background";

  processedTrack?: MediaStreamTrack;

  private sourceTrack: MediaStreamTrack | null = null;
  private inputVideo: HTMLVideoElement | null = null;
  private outputCanvas: HTMLCanvasElement | null = null;
  private outputCtx: CanvasRenderingContext2D | null = null;
  private inferCanvas: HTMLCanvasElement | null = null;
  private inferCtx: CanvasRenderingContext2D | null = null;
  private maskCanvas: HTMLCanvasElement | null = null;
  private maskCtx: CanvasRenderingContext2D | null = null;
  private blurCanvas: HTMLCanvasElement | null = null;
  private blurCtx: CanvasRenderingContext2D | null = null;
  private personCanvas: HTMLCanvasElement | null = null;
  private personCtx: CanvasRenderingContext2D | null = null;
  private capturedStream: MediaStream | null = null;
  private segmenter: ImageSegmenter | null = null;
  private running = false;
  private destroyed = false;
  private frameHandle: number | null = null;
  private useRvfc = false;
  private lastInferAt = 0;
  private frameCount = 0;
  private processedFrames = 0;
  private fpsWindowStart = 0;
  private processingFps = 0;
  private droppedEstimate = 0;

  private mode: VideoEffectMode = "none";
  private imagePath: string | null = null;
  private backgroundBitmap: ImageBitmap | null = null;
  private qualityMode: QualityMode = "auto";
  private activeQuality: QualityTier = "balanced";
  private targetFps = 20;
  private temporalAlpha = DEFAULT_TEMPORAL_ALPHA;
  private featherPx = DEFAULT_FEATHER_PX;
  private autoDowngraded = false;
  private lastQualityChangeAt = 0;
  private rollingInferenceMs = 0;

  private prevMask: Float32Array | null = null;
  private alphaMask: Uint8ClampedArray | null = null;
  private featherScratch: Uint8ClampedArray | null = null;
  private lastAlpha: Uint8ClampedArray | null = null;
  private lastMaskWidth = 0;
  private lastMaskHeight = 0;
  private rawMaskBuffer: Float32Array | null = null;
  private maskImageData: ImageData | null = null;

  private readonly hooks: VirtualBackgroundProcessorOptions;

  constructor(hooks: VirtualBackgroundProcessorOptions = {}) {
    this.hooks = hooks;
  }

  async init(opts: VideoProcessorOptions): Promise<void> {
    this.destroyed = false;
    this.sourceTrack = opts.track;
    this.activeQuality =
      this.qualityMode === "auto"
        ? selectDeviceQuality()
        : this.qualityMode;
    this.targetFps = targetFpsForQuality(this.activeQuality);
    this.lastQualityChangeAt = performance.now();

    await this.setupPipeline(opts.track, opts.element);
    videoEffectsLog("init", {
      quality: this.activeQuality,
      targetFps: this.targetFps,
      mode: this.mode,
    });
  }

  async restart(opts: VideoProcessorOptions): Promise<void> {
    await this.teardownPipeline(false);
    this.sourceTrack = opts.track;
    await this.setupPipeline(opts.track, opts.element);
    videoEffectsLog("restart", { quality: this.activeQuality });
  }

  async destroy(): Promise<void> {
    this.destroyed = true;
    this.running = false;
    await this.teardownPipeline(true);
    videoEffectsLog("destroy", {});
  }

  async setEffect(config: VirtualBackgroundEffectConfig): Promise<void> {
    this.mode = config.mode;
    this.qualityMode = config.qualityMode;
    this.temporalAlpha = config.temporalAlpha ?? DEFAULT_TEMPORAL_ALPHA;
    this.featherPx = config.featherPx ?? DEFAULT_FEATHER_PX;

    if (config.qualityMode !== "auto") {
      this.activeQuality = config.qualityMode;
      this.autoDowngraded = false;
      this.targetFps = targetFpsForQuality(this.activeQuality);
      this.lastQualityChangeAt = performance.now();
    } else if (!this.autoDowngraded) {
      this.activeQuality = selectDeviceQuality();
      this.targetFps = targetFpsForQuality(this.activeQuality);
    }

    const nextPath = config.imagePath ?? null;
    if (config.mode === "image" && nextPath) {
      if (nextPath !== this.imagePath || !this.backgroundBitmap) {
        const raster = await rasterizeToJpegDataUrl(nextPath);
        this.backgroundBitmap = await loadBackgroundBitmap(raster);
        this.imagePath = nextPath;
      }
    } else if (config.mode !== "image") {
      this.imagePath = null;
    }

    videoEffectsLog("setEffect", {
      mode: this.mode,
      qualityMode: this.qualityMode,
      activeQuality: this.activeQuality,
    });
  }

  getStats(): ProcessorStats {
    const res = INFERENCE_RESOLUTIONS[this.activeQuality];
    return {
      inferenceMs: this.rollingInferenceMs,
      processingFps: this.processingFps,
      droppedFrameEstimate: this.droppedEstimate,
      segmentationWidth: res.width,
      segmentationHeight: res.height,
      activeQuality: this.activeQuality,
      autoDowngraded: this.autoDowngraded,
    };
  }

  private async setupPipeline(
    track: MediaStreamTrack,
    element?: HTMLMediaElement,
  ) {
    if (!this.segmenter) {
      this.segmenter = await acquireImageSegmenter();
    }

    this.inputVideo =
      element instanceof HTMLVideoElement
        ? element
        : document.createElement("video");
    this.inputVideo.muted = true;
    this.inputVideo.playsInline = true;
    this.inputVideo.srcObject = new MediaStream([track]);
    await this.inputVideo.play().catch(() => undefined);

    this.outputCanvas = document.createElement("canvas");
    this.outputCanvas.width = OUTPUT_WIDTH;
    this.outputCanvas.height = OUTPUT_HEIGHT;
    this.outputCtx = this.outputCanvas.getContext("2d", {
      willReadFrequently: false,
    });

    this.inferCanvas = document.createElement("canvas");
    this.inferCtx = this.inferCanvas.getContext("2d", {
      willReadFrequently: true,
    });

    this.maskCanvas = document.createElement("canvas");
    this.maskCtx = this.maskCanvas.getContext("2d", {
      willReadFrequently: true,
    });

    this.blurCanvas = document.createElement("canvas");
    this.blurCanvas.width = OUTPUT_WIDTH;
    this.blurCanvas.height = OUTPUT_HEIGHT;
    this.blurCtx = this.blurCanvas.getContext("2d");

    this.personCanvas = document.createElement("canvas");
    this.personCanvas.width = OUTPUT_WIDTH;
    this.personCanvas.height = OUTPUT_HEIGHT;
    this.personCtx = this.personCanvas.getContext("2d");

    this.capturedStream = this.outputCanvas.captureStream(30);
    this.processedTrack = this.capturedStream.getVideoTracks()[0];

    this.running = true;
    this.fpsWindowStart = performance.now();
    this.frameCount = 0;
    this.processedFrames = 0;
    this.useRvfc =
      typeof this.inputVideo.requestVideoFrameCallback === "function";
    this.scheduleNextFrame();
  }

  private async teardownPipeline(releaseSegmenter: boolean) {
    this.running = false;
    if (this.frameHandle != null && this.inputVideo) {
      if (this.useRvfc && "cancelVideoFrameCallback" in this.inputVideo) {
        this.inputVideo.cancelVideoFrameCallback(this.frameHandle);
      } else {
        cancelAnimationFrame(this.frameHandle);
      }
      this.frameHandle = null;
    }

    if (this.processedTrack) {
      try {
        this.processedTrack.stop();
      } catch {
        // ignore
      }
    }
    this.processedTrack = undefined;
    this.capturedStream = null;

    if (this.inputVideo) {
      this.inputVideo.srcObject = null;
      this.inputVideo = null;
    }

    this.outputCanvas = null;
    this.outputCtx = null;
    this.inferCanvas = null;
    this.inferCtx = null;
    this.maskCanvas = null;
    this.maskCtx = null;
    this.blurCanvas = null;
    this.blurCtx = null;
    this.personCanvas = null;
    this.personCtx = null;
    this.sourceTrack = null;
    this.prevMask = null;
    this.alphaMask = null;
    this.featherScratch = null;
    this.lastAlpha = null;
    this.rawMaskBuffer = null;
    this.maskImageData = null;

    if (releaseSegmenter && this.segmenter) {
      this.segmenter = null;
      await releaseImageSegmenter();
    }
  }

  private scheduleNextFrame() {
    if (!this.running || this.destroyed || !this.inputVideo) return;

    if (this.useRvfc) {
      this.frameHandle = this.inputVideo.requestVideoFrameCallback(() => {
        void this.onFrame();
      });
    } else {
      this.frameHandle = requestAnimationFrame(() => {
        void this.onFrame();
      });
    }
  }

  private async onFrame() {
    if (!this.running || this.destroyed) return;

    try {
      await this.processFrame();
    } catch (error) {
      videoEffectsLog("frame-error", {
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.scheduleNextFrame();
    }
  }

  private async processFrame() {
    const video = this.inputVideo;
    const outCtx = this.outputCtx;
    const outCanvas = this.outputCanvas;
    if (!video || !outCtx || !outCanvas || video.readyState < 2) {
      return;
    }

    this.frameCount += 1;
    const now = performance.now();
    const interval = 1000 / Math.max(1, this.targetFps);
    const shouldInfer =
      this.mode !== "none" && now - this.lastInferAt >= interval;

    if (this.mode === "none") {
      outCtx.drawImage(video, 0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
      this.tickFps(now);
      return;
    }

    if (shouldInfer && this.segmenter && this.inferCanvas && this.inferCtx) {
      const res = INFERENCE_RESOLUTIONS[this.activeQuality];
      if (
        this.inferCanvas.width !== res.width ||
        this.inferCanvas.height !== res.height
      ) {
        this.inferCanvas.width = res.width;
        this.inferCanvas.height = res.height;
        this.prevMask = null;
        this.lastAlpha = null;
      }

      this.inferCtx.drawImage(video, 0, 0, res.width, res.height);
      const inferStart = performance.now();
      const result = await segmentVideoFrame(
        this.segmenter,
        this.inferCanvas,
        now,
      );
      const inferMs = performance.now() - inferStart;
      this.rollingInferenceMs = updateRollingAverage(
        this.rollingInferenceMs,
        inferMs,
      );
      this.lastInferAt = now;

      const mask = result.categoryMask;
      if (mask) {
        const data = mask.getAsFloat32Array();
        const length = data.length;
        if (!this.rawMaskBuffer || this.rawMaskBuffer.length !== length) {
          this.rawMaskBuffer = new Float32Array(length);
        }
        // MediaPipe category mask: person category often 0 — invert soft occupancy.
        for (let i = 0; i < length; i += 1) {
          const v = data[i];
          // selfie_segmenter: 0 = person, >0 = background in category mask
          this.rawMaskBuffer[i] = v < 0.5 ? 1 : 0;
        }
        mask.close();

        const refined = refineMaskToAlpha(
          this.rawMaskBuffer,
          this.prevMask,
          this.alphaMask,
          this.temporalAlpha,
        );
        this.prevMask = refined.previous;
        this.alphaMask = refined.alpha;
        if (
          !this.featherScratch ||
          this.featherScratch.length !== this.alphaMask.length
        ) {
          this.featherScratch = new Uint8ClampedArray(this.alphaMask.length);
        }
        featherAlpha(
          this.alphaMask,
          res.width,
          res.height,
          this.featherPx,
          this.featherScratch,
        );
        this.lastAlpha = this.alphaMask;
        this.lastMaskWidth = res.width;
        this.lastMaskHeight = res.height;
      }
      result.close();

      this.maybeAdapt(now);
    } else if (!shouldInfer) {
      this.droppedEstimate += 1;
    }

    this.composite(video, outCtx);
    this.processedFrames += 1;
    this.tickFps(now);
    this.emitStats();
  }

  private composite(
    video: HTMLVideoElement,
    outCtx: CanvasRenderingContext2D,
  ) {
    const w = OUTPUT_WIDTH;
    const h = OUTPUT_HEIGHT;

    // Background layer
    if (this.mode === "image" && this.backgroundBitmap) {
      drawImageCover(outCtx, this.backgroundBitmap, w, h);
    } else if (this.mode === "blur-light" || this.mode === "blur-strong") {
      const blurPx = this.mode === "blur-strong" ? 28 : 16;
      if (this.blurCtx && this.blurCanvas) {
        this.blurCtx.filter = `blur(${blurPx}px)`;
        this.blurCtx.drawImage(video, 0, 0, w, h);
        this.blurCtx.filter = "none";
        outCtx.drawImage(this.blurCanvas, 0, 0);
      } else {
        outCtx.filter = `blur(${blurPx}px)`;
        outCtx.drawImage(video, 0, 0, w, h);
        outCtx.filter = "none";
      }
    } else {
      outCtx.drawImage(video, 0, 0, w, h);
      return;
    }

    if (!this.lastAlpha || !this.maskCanvas || !this.maskCtx) {
      // Fallback: show person without mask until first inference
      outCtx.drawImage(video, 0, 0, w, h);
      return;
    }

    if (
      this.maskCanvas.width !== this.lastMaskWidth ||
      this.maskCanvas.height !== this.lastMaskHeight
    ) {
      this.maskCanvas.width = this.lastMaskWidth;
      this.maskCanvas.height = this.lastMaskHeight;
      this.maskImageData = null;
    }

    if (
      !this.maskImageData ||
      this.maskImageData.width !== this.lastMaskWidth ||
      this.maskImageData.height !== this.lastMaskHeight
    ) {
      this.maskImageData = this.maskCtx.createImageData(
        this.lastMaskWidth,
        this.lastMaskHeight,
      );
    }
    const imageData = this.maskImageData;
    for (let i = 0; i < this.lastAlpha.length; i += 1) {
      const a = this.lastAlpha[i];
      const o = i * 4;
      imageData.data[o] = 255;
      imageData.data[o + 1] = 255;
      imageData.data[o + 2] = 255;
      imageData.data[o + 3] = a;
    }
    this.maskCtx.putImageData(imageData, 0, 0);

    // Draw person with mask
    outCtx.save();
    const personCanvas = this.personCanvas;
    const personCtx = this.personCtx;
    if (!personCanvas || !personCtx) {
      outCtx.restore();
      return;
    }
    personCtx.clearRect(0, 0, w, h);
    personCtx.drawImage(video, 0, 0, w, h);
    personCtx.globalCompositeOperation = "destination-in";
    personCtx.drawImage(this.maskCanvas, 0, 0, w, h);
    personCtx.globalCompositeOperation = "source-over";
    outCtx.drawImage(personCanvas, 0, 0);
    outCtx.restore();
  }

  private maybeAdapt(now: number) {
    if (this.qualityMode !== "auto") return;

    // First try lowering FPS within tier, then downgrade resolution tier.
    const budget = ADAPTIVE_INFERENCE_BUDGET_MS[this.activeQuality];
    if (
      this.rollingInferenceMs > budget &&
      this.targetFps > SEGMENTATION_FPS_MIN(this.activeQuality)
    ) {
      if (now - this.lastQualityChangeAt >= ADAPTIVE_COOLDOWN_MS) {
        this.targetFps = Math.max(
          SEGMENTATION_FPS_MIN(this.activeQuality),
          this.targetFps - 3,
        );
        this.lastQualityChangeAt = now;
        this.autoDowngraded = true;
        this.hooks.onAutoDowngrade?.(this.activeQuality);
        videoEffectsLog("adapt-fps", {
          targetFps: this.targetFps,
          rollingInferenceMs: this.rollingInferenceMs,
        });
      }
      return;
    }

    const result = maybeDowngradeQuality({
      quality: this.activeQuality,
      rollingInferenceMs: this.rollingInferenceMs,
      budgetMs: budget,
      lastChangeAt: this.lastQualityChangeAt,
      now,
      cooldownMs: ADAPTIVE_COOLDOWN_MS,
      autoMode: true,
    });

    if (result.changed) {
      this.activeQuality = result.quality;
      this.targetFps = targetFpsForQuality(result.quality);
      this.lastQualityChangeAt = result.lastChangeAt;
      this.autoDowngraded = true;
      this.hooks.onAutoDowngrade?.(result.quality);
      videoEffectsLog("adapt-quality", {
        quality: result.quality,
        targetFps: this.targetFps,
      });
    }
  }

  private tickFps(now: number) {
    const elapsed = now - this.fpsWindowStart;
    if (elapsed >= 1000) {
      this.processingFps = (this.processedFrames * 1000) / elapsed;
      this.processedFrames = 0;
      this.fpsWindowStart = now;
    }
  }

  private emitStats() {
    this.hooks.onStats?.(this.getStats());
  }
}

function SEGMENTATION_FPS_MIN(quality: QualityTier): number {
  const map = {
    low: 12,
    balanced: 18,
    high: 24,
  } as const;
  return map[quality];
}

export function effectIdToMode(
  effectId: string,
): Pick<VirtualBackgroundEffectConfig, "mode" | "imagePath"> {
  if (effectId === "none") {
    return { mode: "none", imagePath: null };
  }
  if (effectId === "blur") {
    return { mode: "blur-light", imagePath: null };
  }
  if (effectId === "blur-strong") {
    return { mode: "blur-strong", imagePath: null };
  }
  return { mode: "image", imagePath: null };
}
