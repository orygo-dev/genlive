export type BackgroundEffectId =
  | "none"
  | "blur"
  | "blur-strong"
  | "custom"
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
export const BACKGROUND_CUSTOM_IMAGE_KEY = "genmeet_bg_custom_image";

const MAX_CUSTOM_BYTES = 4 * 1024 * 1024;
const MAX_CUSTOM_EDGE = 1600;

export function isBackgroundEffectId(value: string): value is BackgroundEffectId {
  if (
    value === "none" ||
    value === "blur" ||
    value === "blur-strong" ||
    value === "custom"
  ) {
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
    if (raw === "custom" && !readCustomBackgroundImage()) {
      return "none";
    }
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

export function readCustomBackgroundImage(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.sessionStorage.getItem(BACKGROUND_CUSTOM_IMAGE_KEY);
  } catch {
    return null;
  }
}

export function storeCustomBackgroundImage(dataUrl: string) {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.setItem(BACKGROUND_CUSTOM_IMAGE_KEY, dataUrl);
}

export function clearCustomBackgroundImage() {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.removeItem(BACKGROUND_CUSTOM_IMAGE_KEY);
  } catch {
    // ignore
  }
}

export function getBackgroundImagePath(
  effectId: BackgroundEffectId,
): string | null {
  if (effectId === "custom") {
    return readCustomBackgroundImage();
  }
  if (!effectId.startsWith("preset:")) {
    return null;
  }
  const presetId = effectId.slice("preset:".length);
  return BACKGROUND_PRESETS.find((preset) => preset.id === presetId)?.imagePath ?? null;
}

/** @deprecated use getBackgroundImagePath */
export function getPresetImagePath(effectId: BackgroundEffectId): string | null {
  return getBackgroundImagePath(effectId);
}

export async function fileToCustomBackgroundDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Pilih file gambar (JPG, PNG, atau WebP).");
  }
  if (file.size > MAX_CUSTOM_BYTES) {
    throw new Error("Ukuran gambar maksimal 4 MB.");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const scale = Math.min(1, MAX_CUSTOM_EDGE / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Gambar belum dapat diproses.");
    }
    // Soften image slightly so harsh textures don't amplify jagged cutout edges.
    context.filter = "blur(1.2px) contrast(0.98) saturate(0.98)";
    context.drawImage(image, 0, 0, width, height);
    context.filter = "none";
    return canvas.toDataURL("image/jpeg", 0.9);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Gambar tidak valid."));
    image.src = src;
  });
}
