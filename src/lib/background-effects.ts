export type BackgroundEffectId =
  | "none"
  | "blur"
  | "blur-strong"
  | `preset:${string}`;

export type BackgroundPreset = {
  id: string;
  label: string;
  imagePath: string;
  swatch: string;
};

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  {
    id: "soft-blue",
    label: "Biru lembut",
    imagePath: "/backgrounds/soft-blue.svg",
    swatch: "linear-gradient(145deg,#1d4ed8,#93c5fd)",
  },
  {
    id: "office",
    label: "Kantor",
    imagePath: "/backgrounds/office.svg",
    swatch: "linear-gradient(145deg,#334155,#94a3b8)",
  },
  {
    id: "warm",
    label: "Hangat",
    imagePath: "/backgrounds/warm.svg",
    swatch: "linear-gradient(145deg,#c2410c,#fdba74)",
  },
];

export const BACKGROUND_EFFECT_STORAGE_KEY = "genmeet_bg_effect";

export function isBackgroundEffectId(value: string): value is BackgroundEffectId {
  if (value === "none" || value === "blur" || value === "blur-strong") {
    return true;
  }
  if (!value.startsWith("preset:")) {
    return false;
  }
  const presetId = value.slice("preset:".length);
  return BACKGROUND_PRESETS.some((preset) => preset.id === presetId);
}

export function readStoredBackgroundEffect(): BackgroundEffectId {
  if (typeof window === "undefined") {
    return "none";
  }
  try {
    const raw = window.sessionStorage.getItem(BACKGROUND_EFFECT_STORAGE_KEY);
    if (raw && isBackgroundEffectId(raw)) {
      return raw;
    }
  } catch {
    // ignore
  }
  return "none";
}

export function storeBackgroundEffect(effectId: BackgroundEffectId) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.setItem(BACKGROUND_EFFECT_STORAGE_KEY, effectId);
  } catch {
    // ignore
  }
}

export function getPresetImagePath(effectId: BackgroundEffectId): string | null {
  if (!effectId.startsWith("preset:")) {
    return null;
  }
  const presetId = effectId.slice("preset:".length);
  return BACKGROUND_PRESETS.find((preset) => preset.id === presetId)?.imagePath ?? null;
}
