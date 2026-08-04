import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/db";
import {
  DEFAULT_APP_NAME,
  defaultMobilePopupAd,
  defaultPlatformBranding,
  normalizeMobileBannerSlides,
  normalizeMobilePopupAd,
  type MobileBannerSlide,
  type MobilePopupAd,
  type PlatformBranding,
} from "@/lib/platform-branding";

function toBranding(settings: {
  appName: string;
  logoUrl: string | null;
  loginBackgroundUrl: string | null;
  splashBackgroundUrl: string | null;
  splashLogoUrl: string | null;
  mobileBannerSlides: unknown;
  mobilePopupAd?: unknown;
}): PlatformBranding {
  return {
    appName: settings.appName || DEFAULT_APP_NAME,
    logoUrl: settings.logoUrl,
    loginBackgroundUrl: settings.loginBackgroundUrl,
    splashBackgroundUrl: settings.splashBackgroundUrl,
    splashLogoUrl: settings.splashLogoUrl,
    mobileBannerSlides: normalizeMobileBannerSlides(settings.mobileBannerSlides),
    mobilePopupAd: normalizeMobilePopupAd(settings.mobilePopupAd),
  };
}

const brandingSelectCore = {
  appName: true,
  logoUrl: true,
  loginBackgroundUrl: true,
  splashBackgroundUrl: true,
  splashLogoUrl: true,
  mobileBannerSlides: true,
} as const;

const brandingSelect = {
  ...brandingSelectCore,
  mobilePopupAd: true,
} as const;

function isMissingPopupColumnError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  return (
    /mobile_popup_ad/i.test(message) ||
    /Unknown column .*mobile_popup_ad/i.test(message) ||
    (/mobilePopupAd/i.test(message) && /column/i.test(message))
  );
}

export const getPlatformBranding = cache(async (): Promise<PlatformBranding> => {
  try {
    const settings = await prisma.platformSettings.upsert({
      where: { id: 1 },
      create: { id: 1, appName: DEFAULT_APP_NAME },
      update: {},
      select: brandingSelect,
    });

    return toBranding(settings);
  } catch (error) {
    // Deploy order: new code before migration must not wipe logo/banner data.
    if (isMissingPopupColumnError(error)) {
      console.warn(
        "[branding] mobile_popup_ad column missing — run npm run db:deploy",
      );
      try {
        const settings = await prisma.platformSettings.upsert({
          where: { id: 1 },
          create: { id: 1, appName: DEFAULT_APP_NAME },
          update: {},
          select: brandingSelectCore,
        });
        return toBranding({
          ...settings,
          mobilePopupAd: defaultMobilePopupAd,
        });
      } catch (legacyError) {
        console.error("[branding] legacy branding read failed", legacyError);
      }
    } else {
      console.error("[branding] getPlatformBranding failed", error);
    }
    return defaultPlatformBranding;
  }
});

export async function updatePlatformBranding(
  input: Partial<PlatformBranding> & { updatedById?: string | null },
) {
  const data: {
    appName?: string;
    logoUrl?: string | null;
    loginBackgroundUrl?: string | null;
    splashBackgroundUrl?: string | null;
    splashLogoUrl?: string | null;
    mobileBannerSlides?: MobileBannerSlide[];
    mobilePopupAd?: MobilePopupAd;
    updatedById?: string | null;
  } = {};

  if (input.appName !== undefined) data.appName = input.appName;
  if (input.logoUrl !== undefined) data.logoUrl = input.logoUrl;
  if (input.loginBackgroundUrl !== undefined) {
    data.loginBackgroundUrl = input.loginBackgroundUrl;
  }
  if (input.splashBackgroundUrl !== undefined) {
    data.splashBackgroundUrl = input.splashBackgroundUrl;
  }
  if (input.splashLogoUrl !== undefined) data.splashLogoUrl = input.splashLogoUrl;
  if (input.mobileBannerSlides !== undefined) {
    data.mobileBannerSlides = normalizeMobileBannerSlides(
      input.mobileBannerSlides,
    );
  }
  if (input.mobilePopupAd !== undefined) {
    const normalized = normalizeMobilePopupAd(input.mobilePopupAd);
    data.mobilePopupAd = {
      ...normalized,
      updatedAt: new Date().toISOString(),
    };
  }

  try {
    const settings = await prisma.platformSettings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        appName: input.appName?.trim() || DEFAULT_APP_NAME,
        logoUrl: input.logoUrl ?? null,
        loginBackgroundUrl: input.loginBackgroundUrl ?? null,
        splashBackgroundUrl: input.splashBackgroundUrl ?? null,
        splashLogoUrl: input.splashLogoUrl ?? null,
        mobileBannerSlides: data.mobileBannerSlides ?? [],
        mobilePopupAd: data.mobilePopupAd ?? null,
        updatedById: input.updatedById ?? null,
      },
      update: {
        ...data,
        updatedById: input.updatedById ?? undefined,
      },
      select: brandingSelect,
    });

    return toBranding(settings);
  } catch (error) {
    if (input.mobilePopupAd !== undefined && isMissingPopupColumnError(error)) {
      throw new Error(
        "Kolom popup ads belum ada di database. Jalankan: npm run db:deploy",
      );
    }
    throw error;
  }
}
