import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { loginSchema } from "@/lib/auth-validation";
import { prisma } from "@/lib/db";
import { maintenanceBlockResponse } from "@/lib/maintenance";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { syncSuperAdminFlag } from "@/lib/super-admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    const ipLimit = rateLimit(`login:ip:${ip}`, 20, 15 * 60_000);
    if (!ipLimit.ok) {
      return NextResponse.json(
        { error: "Terlalu banyak percobaan login. Coba lagi nanti." },
        {
          status: 429,
          headers: { "Retry-After": String(ipLimit.retryAfterSec) },
        },
      );
    }

    const payload: unknown = await request.json();
    const result = loginSchema.safeParse(payload);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message ?? "Data tidak valid." },
        { status: 400 },
      );
    }

    const emailLimit = rateLimit(
      `login:email:${result.data.email}`,
      8,
      15 * 60_000,
    );
    if (!emailLimit.ok) {
      return NextResponse.json(
        { error: "Terlalu banyak percobaan untuk email ini." },
        {
          status: 429,
          headers: { "Retry-After": String(emailLimit.retryAfterSec) },
        },
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: result.data.email },
      select: {
        id: true,
        name: true,
        email: true,
        passwordHash: true,
        isSuperAdmin: true,
        isDisabled: true,
        memberships: {
          orderBy: { joinedAt: "asc" },
          take: 1,
          select: { organizationId: true },
        },
      },
    });
    const passwordMatches =
      user && (await compare(result.data.password, user.passwordHash));

    if (!user || !passwordMatches) {
      return NextResponse.json(
        { error: "Email atau password tidak sesuai." },
        { status: 401 },
      );
    }

    if (user.isDisabled) {
      return NextResponse.json(
        { error: "Akun dinonaktifkan. Hubungi Super Admin." },
        { status: 403 },
      );
    }

    const syncedSuperAdmin = await syncSuperAdminFlag(user.id, user.email);
    const isSuperAdmin = syncedSuperAdmin || user.isSuperAdmin;

    // Non–super-admin cannot use the app during maintenance (login blocked).
    // Super Admin may always log in to turn maintenance off.
    if (!isSuperAdmin) {
      const maintenance = await maintenanceBlockResponse();
      if (maintenance) return maintenance;
    }

    await createSession(user.id, user.memberships[0]?.organizationId);

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isSuperAdmin,
      },
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Format data tidak valid." }, { status: 400 });
    }

    console.error("Login failed", error);
    return NextResponse.json(
      { error: "Login belum dapat diproses. Silakan coba kembali." },
      { status: 500 },
    );
  }
}
