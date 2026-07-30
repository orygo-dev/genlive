import { NextResponse } from "next/server";
import { getCurrentSessionContext } from "@/lib/auth";
import { updateProfileSchema } from "@/lib/auth-validation";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  try {
    const context = await getCurrentSessionContext();
    if (!context) {
      return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
    }

    const payload: unknown = await request.json();
    const parsed = updateProfileSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Data profil tidak valid." },
        { status: 400 },
      );
    }

    const user = await prisma.user.update({
      where: { id: context.user.id },
      data: { name: parsed.data.name },
      select: { id: true, name: true, email: true },
    });

    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Format data tidak valid." }, { status: 400 });
    }

    console.error("Update profile failed", error);
    return NextResponse.json(
      { error: "Profil belum dapat diperbarui." },
      { status: 500 },
    );
  }
}
