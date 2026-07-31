import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdminApi } from "@/lib/admin-api";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const bodySchema = z.object({
  isDisabled: z.boolean().optional(),
  revokeSessions: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const gate = await requireSuperAdminApi();
  if (gate.error || !gate.context) return gate.error!;

  const { id } = await context.params;
  if (id === gate.context.user.id) {
    return NextResponse.json(
      { error: "Tidak dapat menonaktifkan akun Super Admin yang sedang login." },
      { status: 400 },
    );
  }

  const payload: unknown = await request.json();
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, isSuperAdmin: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
  }

  if (parsed.data.isDisabled !== undefined) {
    await prisma.user.update({
      where: { id },
      data: { isDisabled: parsed.data.isDisabled },
    });
  }

  if (parsed.data.revokeSessions || parsed.data.isDisabled === true) {
    await prisma.session.deleteMany({ where: { userId: id } });
  }

  const updated = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      isSuperAdmin: true,
      isDisabled: true,
      createdAt: true,
      _count: { select: { sessions: true } },
    },
  });

  return NextResponse.json({ user: updated });
}
