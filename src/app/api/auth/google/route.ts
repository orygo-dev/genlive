import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getGoogleAuthUrl, isGoogleOAuthConfigured } from "@/lib/oauth-google";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const STATE_COOKIE = "google_oauth_state";
const STATE_TTL_SEC = 600;

export async function GET(request: Request) {
  const ip = clientIp(request);
  const limited = rateLimit(`oauth:google:start:${ip}`, 15, 15 * 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Terlalu banyak percobaan login Google. Coba lagi nanti." },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    );
  }

  const configured = await isGoogleOAuthConfigured();
  if (!configured) {
    return NextResponse.json(
      { error: "Login Google belum tersedia." },
      { status: 503 },
    );
  }

  const state = randomBytes(24).toString("base64url");
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/google",
    maxAge: STATE_TTL_SEC,
  });

  const url = await getGoogleAuthUrl(state, request.headers.get("origin"));
  return NextResponse.redirect(url);
}
