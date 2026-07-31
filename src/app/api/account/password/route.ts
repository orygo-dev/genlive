import { compare, hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { getCurrentSessionContext } from "@/lib/auth";
import { changePasswordSchema } from "@/lib/auth-validation";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  try {
    const context = await getCurrentSessionContext();
    if (!context) {
      return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
    }

    const payload: unknown = await request.json();
    const parsed = changePasswordSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Data password tidak valid." },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: context.user.id },
      select: { id: true, passwordHash: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
    }

    if (!user.passwordHash) {
      return NextResponse.json(
        { error: "Akun ini memakai login Google. Atur password dari profil jika diperlukan." },
        { status: 400 },
      );
    }

    const matches = await compare(
      parsed.data.currentPassword,
      user.passwordHash,
    );
    if (!matches) {
      return NextResponse.json(
        { error: "Password saat ini tidak sesuai." },
        { status: 403 },
      );
    }

    if (parsed.data.currentPassword === parsed.data.newPassword) {
      return NextResponse.json(
        { error: "Password baru harus berbeda dari password saat ini." },
        { status: 400 },
      );
    }

    const passwordHash = await hash(parsed.data.newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Format data tidak valid." }, { status: 400 });
    }

    console.error("Change password failed", error);
    return NextResponse.json(
      { error: "Password belum dapat diubah." },
      { status: 500 },
    );
  }
}
