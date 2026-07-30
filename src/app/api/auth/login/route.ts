import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { loginSchema } from "@/lib/auth-validation";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload: unknown = await request.json();
    const result = loginSchema.safeParse(payload);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message ?? "Data tidak valid." },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: result.data.email },
      select: {
        id: true,
        name: true,
        email: true,
        passwordHash: true,
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

    await createSession(user.id, user.memberships[0]?.organizationId);

    return NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email },
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
