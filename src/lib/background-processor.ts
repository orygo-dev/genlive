import {
  BackgroundProcessor,
  supportsModernBackgroundProcessors,
  type BackgroundProcessorWrapper,
  type SwitchBackgroundProcessorOptions,
} from "@livekit/track-processors";
import type { LocalVideoTrack } from "livekit-client";
import { VideoPresets } from "livekit-client";
import {
  getBackgroundImagePath,
  type BackgroundEffectId,
} from "@/lib/background-effects";

/** Landscape selfie model tends to be stabler for webcam 16:9 frames. */
const SEGMENTER_MODEL =
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter_landscape/float16/latest/selfie_segmenter_landscape.tflite";

export function createDisabledBackgroundProcessor() {
  return BackgroundProcessor(
    {
      mode: "disabled",
      // Prefer GPU; fall back handled by MediaPipe if unavailable.
      segmenterOptions: {
        delegate: "GPU",
      },
      assetPaths: {
        modelAssetPath: SEGMENTER_MODEL,
      },
      // Lower FPS = less mask jitter / “wavy” edges under load.
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
    // Slightly stronger blur hides residual mask flicker better.
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

export function isVirtualBackgroundEffect(effectId: BackgroundEffectId) {
  return effectId === "custom" || effectId.startsWith("preset:");
}

const tunedForEffects = new WeakSet<LocalVideoTrack>();

/**
 * Cap camera to 720p@24 when effects are on — steadier segmentation than 1080p.
 * Only restarts once per track while effects stay on (avoids flicker on effect switches).
 * Re-attach processor after restart because constraints restart replaces the MediaStreamTrack.
 */
export async function tuneCameraForBackgroundEffect(
  track: LocalVideoTrack,
  effectId: BackgroundEffectId,
  processor: BackgroundProcessorWrapper | null,
) {
  if (effectId === "none") {
    return;
  }

  if (!tunedForEffects.has(track)) {
    try {
      await track.restartTrack({
        resolution: VideoPresets.h720.resolution,
        frameRate: 24,
      });
      tunedForEffects.add(track);
    } catch {
      // Some devices reject exact constraints; keep current track.
    }

    if (processor) {
      try {
        await track.setProcessor(processor);
      } catch {
        // ignore re-attach races
      }
    }
  }
}

export async function applyBackgroundEffect(
  processor: BackgroundProcessorWrapper,
  effectId: BackgroundEffectId,
  track?: LocalVideoTrack | null,
  options?: { retuneCamera?: boolean },
) {
  const retuneCamera = options?.retuneCamera ?? true;
  if (track && retuneCamera) {
    await tuneCameraForBackgroundEffect(track, effectId, processor);
  }

  await processor.switchTo(toProcessorSwitchOptions(effectId));
}
