export type VideoEffectMode =
  | "none"
  | "blur-light"
  | "blur-strong"
  | "image";

export type QualityTier = "low" | "balanced" | "high";

export type QualityMode = "auto" | QualityTier;

export type InferenceResolution = {
  width: number;
  height: number;
};

export const OUTPUT_WIDTH = 1280;
export const OUTPUT_HEIGHT = 720;

export const INFERENCE_RESOLUTIONS: Record<QualityTier, InferenceResolution> = {
  low: { width: 256, height: 144 },
  balanced: { width: 384, height: 216 },
  high: { width: 512, height: 288 },
};

export const SEGMENTATION_FPS: Record<QualityTier, { min: number; max: number }> =
  {
    low: { min: 12, max: 15 },
    balanced: { min: 18, max: 24 },
    high: { min: 24, max: 30 },
  };

export const DEFAULT_TEMPORAL_ALPHA = 0.78;
export const DEFAULT_FEATHER_PX = 3;
export const ADAPTIVE_COOLDOWN_MS = 5000;
export const ADAPTIVE_INFERENCE_BUDGET_MS: Record<QualityTier, number> = {
  low: 40,
  balanced: 28,
  high: 18,
};

export type VirtualBackgroundEffectConfig = {
  mode: VideoEffectMode;
  /** Background image URL or data URL when mode === "image" */
  imagePath?: string | null;
  qualityMode: QualityMode;
  temporalAlpha?: number;
  featherPx?: number;
};

export type ProcessorStats = {
  inferenceMs: number;
  processingFps: number;
  droppedFrameEstimate: number;
  segmentationWidth: number;
  segmentationHeight: number;
  activeQuality: QualityTier;
  autoDowngraded: boolean;
};

export type AdaptiveControllerState = {
  quality: QualityTier;
  targetFps: number;
  lastChangeAt: number;
  autoDowngraded: boolean;
  rollingInferenceMs: number;
};
