import { NextResponse } from "next/server";
import {
  defaultMobilePopupAd,
  defaultPlatformBranding,
} from "@/lib/platform-branding";
import { getPlatformBranding } from "@/lib/platform-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const branding = await getPlatformBranding();
  // Always expose mobilePopupAd so older caches / partial deploys stay schema-stable.
  return NextResponse.json(
    {
      branding: {
        ...defaultPlatformBranding,
        ...branding,
        mobilePopupAd: branding.mobilePopupAd ?? defaultMobilePopupAd,
        mobileBannerSlides: branding.mobileBannerSlides ?? [],
      },
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
