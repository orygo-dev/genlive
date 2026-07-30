import { NextResponse } from "next/server";
import { getPlatformBranding } from "@/lib/platform-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const branding = await getPlatformBranding();
  return NextResponse.json(
    { branding },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
