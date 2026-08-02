import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/db";
import {
  DEFAULT_APP_NAME,
  defaultPlatformBranding,
  normalizeMobileBannerSlides,
  type MobileBannerSlide,
  type PlatformBranding,
} from "@/lib/platform-branding";

function toBranding(settings: {
  appName: string;
  logoUrl: string | null;
  loginBackgroundUrl: string | null;
  splashBackgroundUrl: string | null;
  splashLogoUrl: string | null;
  mobileBannerSlides: unknown;
}): PlatformBranding {
  return {
    appName: settings.appName || DEFAULT_APP_NAME,
    logoUrl: settings.logoUrl,
    loginBackgroundUrl: settings.loginBackgroundUrl,
    splashBackgroundUrl: settings.splashBackgroundUrl,
    splashLogoUrl: settings.splashLogoUrl,
    mobileBannerSlides: normalizeMobileBannerSlides(settings.mobileBannerSlides),
  };
}

const brandingSelect = {
  appName: true,
  logoUrl: true,
  loginBackgroundUrl: true,
  splashBackgroundUrl: true,
  splashLogoUrl: true,
  mobileBannerSlides: true,
} as const;

export const getPlatformBranding = cache(async (): Promise<PlatformBranding> => {
  try {
    const settings = await prisma.platformSettings.upsert({
      where: { id: 1 },
      create: { id: 1, appName: DEFAULT_APP_NAME },
      update: {},
      select: brandingSelect,
    });

    return toBranding(settings);
  } catch {
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
      updatedById: input.updatedById ?? null,
    },
    update: {
      ...data,
      updatedById: input.updatedById ?? undefined,
    },
    select: brandingSelect,
  });

  return toBranding(settings);
}
