import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { createAuthToken } from "@/lib/auth-tokens";
import { createSession } from "@/lib/auth";
import { registerSchema } from "@/lib/auth-validation";
import { absoluteUrl } from "@/lib/app-url";
import { prisma } from "@/lib/db";
import { buildEmailVerificationEmail } from "@/lib/email-templates";
import { sendEmail } from "@/lib/email";
import { maintenanceBlockResponse } from "@/lib/maintenance";
import { createOrganizationSlug } from "@/lib/organization-helpers";
import { getPlatformBranding } from "@/lib/platform-settings";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const maintenance = await maintenanceBlockResponse();
    if (maintenance) return maintenance;

    const ip = clientIp(request);
    const limited = rateLimit(`register:ip:${ip}`, 5, 60 * 60_000);
    if (!limited.ok) {
      return NextResponse.json(
        { error: "Terlalu banyak pendaftaran dari jaringan ini. Coba lagi nanti." },
        {
          status: 429,
          headers: { "Retry-After": String(limited.retryAfterSec) },
        },
      );
    }

    const payload: unknown = await request.json();
    const result = registerSchema.safeParse(payload);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message ?? "Data tidak valid." },
        { status: 400 },
      );
    }

    const passwordHash = await hash(result.data.password, 12);
    const user = await prisma.user.create({
      data: {
        name: result.data.name,
        email: result.data.email,
        passwordHash,
        memberships: {
          create: {
            role: "OWNER",
            organization: {
              create: {
                name: result.data.organizationName,
                slug: createOrganizationSlug(result.data.organizationName),
              },
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        memberships: {
          take: 1,
          select: { organizationId: true },
        },
      },
    });

    await createSession(user.id, user.memberships[0]?.organizationId);

    try {
      const rawToken = await createAuthToken(user.id, "EMAIL_VERIFY");
      const branding = await getPlatformBranding();
      const verifyUrl = await absoluteUrl(
        `/auth/verify?token=${encodeURIComponent(rawToken)}`,
        request.headers.get("origin"),
      );
      const message = buildEmailVerificationEmail({
        appName: branding.appName,
        userName: user.name,
        verifyUrl,
      });
      void sendEmail({ to: user.email, ...message }).catch((error) => {
        logger.warn("Verification email failed on register", {
          userId: user.id,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    } catch (error) {
      logger.warn("Verification token failed on register", {
        userId: user.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Email tersebut sudah terdaftar." },
        { status: 409 },
      );
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Format data tidak valid." }, { status: 400 });
    }

    console.error("Registration failed", error);
    return NextResponse.json(
      { error: "Pendaftaran belum dapat diproses. Silakan coba kembali." },
      { status: 500 },
    );
  }
}
