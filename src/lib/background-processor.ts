import {
  BackgroundProcessor,
  type BackgroundProcessorWrapper,
  type SwitchBackgroundProcessorOptions,
} from "@livekit/track-processors";
import {
  getPresetImagePath,
  type BackgroundEffectId,
} from "@/lib/background-effects";

export function createDisabledBackgroundProcessor() {
  return BackgroundProcessor({ mode: "disabled" });
}

export function toProcessorSwitchOptions(
  effectId: BackgroundEffectId,
): SwitchBackgroundProcessorOptions {
  if (effectId === "none") {
    return { mode: "disabled" };
  }
  if (effectId === "blur") {
    return { mode: "background-blur", blurRadius: 12 };
  }
  if (effectId === "blur-strong") {
    return { mode: "background-blur", blurRadius: 24 };
  }

  const imagePath = getPresetImagePath(effectId);
  if (!imagePath) {
    return { mode: "disabled" };
  }
  return { mode: "virtual-background", imagePath };
}

export async function applyBackgroundEffect(
  processor: BackgroundProcessorWrapper,
  effectId: BackgroundEffectId,
) {
  await processor.switchTo(toProcessorSwitchOptions(effectId));
}
