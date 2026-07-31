import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { consumeAuthToken } from "@/lib/auth-tokens";
import { passwordSchema } from "@/lib/auth-validation";
import { prisma } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const bodySchema = z.object({
  token: z.string().min(1, "Token wajib diisi."),
  password: passwordSchema,
});

export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    const limited = rateLimit(`reset-password:ip:${ip}`, 10, 60 * 60_000);
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
    const result = bodySchema.safeParse(payload);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message ?? "Data tidak valid." },
        { status: 400 },
      );
    }

    const consumed = await consumeAuthToken(result.data.token, "PASSWORD_RESET");
    if (!consumed) {
      return NextResponse.json(
        { error: "Tautan reset tidak valid atau sudah kedaluwarsa." },
        { status: 400 },
      );
    }

    const passwordHash = await hash(result.data.password, 12);
    await prisma.user.update({
      where: { id: consumed.userId },
      data: { passwordHash },
    });

    await prisma.session.deleteMany({ where: { userId: consumed.userId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Format data tidak valid." }, { status: 400 });
    }

    logger.error("Reset password failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Password belum dapat diperbarui. Silakan coba lagi." },
      { status: 500 },
    );
  }
}
