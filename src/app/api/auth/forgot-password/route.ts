import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthToken } from "@/lib/auth-tokens";
import { emailSchema } from "@/lib/auth-validation";
import { absoluteUrl } from "@/lib/app-url";
import { prisma } from "@/lib/db";
import { buildPasswordResetEmail } from "@/lib/email-templates";
import { sendEmail } from "@/lib/email";
import { getPlatformBranding } from "@/lib/platform-settings";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const GENERIC_MESSAGE =
  "Jika email terdaftar, kami mengirim tautan reset password. Periksa kotak masuk Anda.";

const bodySchema = z.object({ email: emailSchema });

export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    const limited = rateLimit(`forgot-password:ip:${ip}`, 5, 60 * 60_000);
    if (!limited.ok) {
      return NextResponse.json(
        { message: GENERIC_MESSAGE },
        { status: 200, headers: { "Retry-After": String(limited.retryAfterSec) } },
      );
    }

    const payload: unknown = await request.json();
    const result = bodySchema.safeParse(payload);
    if (!result.success) {
      return NextResponse.json({ message: GENERIC_MESSAGE });
    }

    const user = await prisma.user.findUnique({
      where: { email: result.data.email },
      select: { id: true, name: true, email: true, isDisabled: true },
    });

    if (user && !user.isDisabled) {
      const emailLimited = rateLimit(
        `forgot-password:email:${user.email}`,
        3,
        60 * 60_000,
      );
      if (emailLimited.ok) {
        const rawToken = await createAuthToken(user.id, "PASSWORD_RESET");
        const branding = await getPlatformBranding();
        const resetUrl = await absoluteUrl(
          `/auth/reset?token=${encodeURIComponent(rawToken)}`,
          request.headers.get("origin"),
        );
        const message = buildPasswordResetEmail({
          appName: branding.appName,
          userName: user.name,
          resetUrl,
        });

        void sendEmail({
          to: user.email,
          ...message,
        }).catch((error) => {
          logger.warn("Password reset email failed", {
            userId: user.id,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }
    }

    return NextResponse.json({ message: GENERIC_MESSAGE });
  } catch (error) {
    logger.error("Forgot password failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ message: GENERIC_MESSAGE });
  }
}
