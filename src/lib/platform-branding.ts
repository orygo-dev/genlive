export const DEFAULT_APP_NAME = "GenMeet";

/** Recommended upload size for mobile home banner slides. */
export const MOBILE_BANNER_RECOMMENDED = {
  width: 1080,
  height: 432,
  aspectLabel: "2.5:1",
  maxSlides: 5,
  maxBytesLabel: "2 MB",
} as const;

export type MobileBannerSlide = {
  id: string;
  imageUrl: string;
  title: string;
  body: string;
  linkUrl?: string | null;
  active: boolean;
};

export type PlatformBranding = {
  appName: string;
  logoUrl: string | null;
  loginBackgroundUrl: string | null;
  splashBackgroundUrl: string | null;
  splashLogoUrl: string | null;
  mobileBannerSlides: MobileBannerSlide[];
};

export const defaultPlatformBranding: PlatformBranding = {
  appName: DEFAULT_APP_NAME,
  logoUrl: null,
  loginBackgroundUrl: null,
  splashBackgroundUrl: null,
  splashLogoUrl: null,
  mobileBannerSlides: [],
};

export function normalizeMobileBannerSlides(
  value: unknown,
): MobileBannerSlide[] {
  if (!Array.isArray(value)) return [];
  const slides: MobileBannerSlide[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id.trim() : "";
    const imageUrl =
      typeof record.imageUrl === "string" ? record.imageUrl.trim() : "";
    if (!id || !imageUrl) continue;
    slides.push({
      id,
      imageUrl,
      title: typeof record.title === "string" ? record.title.trim() : "",
      body: typeof record.body === "string" ? record.body.trim() : "",
      linkUrl:
        typeof record.linkUrl === "string" && record.linkUrl.trim()
          ? record.linkUrl.trim()
          : null,
      active: record.active !== false,
    });
    if (slides.length >= MOBILE_BANNER_RECOMMENDED.maxSlides) break;
  }
  return slides;
}
