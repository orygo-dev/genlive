/**
 * @deprecated Use `@/features/video-effects` + `useVirtualBackground` instead.
 * Kept as a thin compatibility shim for older imports/tests.
 */
export {
  effectIdToMode as toProcessorSwitchOptionsCompat,
} from "@/features/video-effects/VirtualBackgroundProcessor";

import { getBackgroundImagePath, type BackgroundEffectId } from "@/lib/background-effects";

/** @deprecated Legacy mapping used by unit tests — prefer VirtualBackgroundProcessor.setEffect */
export function toProcessorSwitchOptions(effectId: BackgroundEffectId) {
  if (effectId === "none") {
    return { mode: "disabled" as const };
  }
  if (effectId === "blur") {
    return { mode: "background-blur" as const, blurRadius: 16 };
  }
  if (effectId === "blur-strong") {
    return { mode: "background-blur" as const, blurRadius: 28 };
  }
  const imagePath = getBackgroundImagePath(effectId);
  if (!imagePath) {
    return { mode: "disabled" as const };
  }
  return { mode: "virtual-background" as const, imagePath };
}
