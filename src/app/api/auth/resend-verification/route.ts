import { NextResponse } from "next/server";
import { createAuthToken } from "@/lib/auth-tokens";
import { getCurrentUser } from "@/lib/auth";
import { absoluteUrl } from "@/lib/app-url";
import { prisma } from "@/lib/db";
import { buildEmailVerificationEmail } from "@/lib/email-templates";
import { sendEmail } from "@/lib/email";
import { getPlatformBranding } from "@/lib/platform-settings";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Anda perlu masuk terlebih dahulu." }, { status: 401 });
  }

  const ip = clientIp(request);
  const limited = rateLimit(`resend-verification:ip:${ip}`, 5, 60 * 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Terlalu banyak permintaan. Coba lagi nanti." },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    );
  }

  const emailLimited = rateLimit(
    `resend-verification:user:${user.id}`,
    3,
    60 * 60_000,
  );
  if (!emailLimited.ok) {
    return NextResponse.json(
      { error: "Email verifikasi baru dapat dikirim ulang setelah beberapa saat." },
      {
        status: 429,
        headers: { "Retry-After": String(emailLimited.retryAfterSec) },
      },
    );
  }

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, name: true, email: true, emailVerifiedAt: true },
  });

  if (!record) {
    return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });
  }

  if (record.emailVerifiedAt) {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }

  try {
    const rawToken = await createAuthToken(record.id, "EMAIL_VERIFY");
    const branding = await getPlatformBranding();
    const verifyUrl = await absoluteUrl(
      `/auth/verify?token=${encodeURIComponent(rawToken)}`,
      request.headers.get("origin"),
    );
    const message = buildEmailVerificationEmail({
      appName: branding.appName,
      userName: record.name,
      verifyUrl,
    });

    void sendEmail({
      to: record.email,
      ...message,
    }).catch((error) => {
      logger.warn("Resend verification email failed", {
        userId: record.id,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    return NextResponse.json({ ok: true, sent: true });
  } catch (error) {
    logger.error("Resend verification failed", {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Email verifikasi belum dapat dikirim." },
      { status: 500 },
    );
  }
}
