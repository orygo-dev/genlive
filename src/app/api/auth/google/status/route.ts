import { NextResponse } from "next/server";
import { isGoogleOAuthConfigured } from "@/lib/oauth-google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const configured = await isGoogleOAuthConfigured();
  return NextResponse.json({ configured });
}
