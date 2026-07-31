import { NextResponse } from "next/server";
import { z } from "zod";
import { consumeAuthToken } from "@/lib/auth-tokens";
import { prisma } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const tokenSchema = z.object({
  token: z.string().min(1, "Token wajib diisi."),
});

async function verifyToken(rawToken: string) {
  const consumed = await consumeAuthToken(rawToken, "EMAIL_VERIFY");
  if (!consumed) {
    return { ok: false as const, error: "Tautan verifikasi tidak valid atau sudah kedaluwarsa." };
  }

  await prisma.user.update({
    where: { id: consumed.userId },
    data: { emailVerifiedAt: new Date() },
  });

  return { ok: true as const };
}

export async function GET(request: Request) {
  const ip = clientIp(request);
  const limited = rateLimit(`verify-email:ip:${ip}`, 20, 60 * 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Terlalu banyak percobaan. Coba lagi nanti." },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    );
  }

  const { searchParams } = new URL(request.url);
  const parsed = tokenSchema.safeParse({ token: searchParams.get("token") ?? "" });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Token tidak valid." },
      { status: 400 },
    );
  }

  const result = await verifyToken(parsed.data.token);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, verified: true });
}

export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    const limited = rateLimit(`verify-email:ip:${ip}`, 20, 60 * 60_000);
    if (!limited.ok) {
      return NextResponse.json(
        { error: "Terlalu banyak percobaan. Coba lagi nanti." },
        {
          status: 429,
          headers: { "Retry-After": String(limited.retryAfterSec) },
        },
      );
    }

    const payload: unknown = await request.json();
    const parsed = tokenSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Token tidak valid." },
        { status: 400 },
      );
    }

    const result = await verifyToken(parsed.data.token);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, verified: true });
  } catch (error) {
    logger.error("Verify email failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Verifikasi belum dapat diproses." },
      { status: 500 },
    );
  }
}
