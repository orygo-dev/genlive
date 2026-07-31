import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdminApi } from "@/lib/admin-api";
import {
  displayNameSchema,
  emailSchema,
  passwordSchema,
} from "@/lib/auth-validation";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const bodySchema = z.object({
  name: displayNameSchema.optional(),
  email: emailSchema.optional(),
  password: passwordSchema.optional(),
  isDisabled: z.boolean().optional(),
  isSuperAdmin: z.boolean().optional(),
  revokeSessions: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const gate = await requireSuperAdminApi();
  if (gate.error || !gate.context) return gate.error!;

  const { id } = await context.params;
  const payload: unknown = await request.json();
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  if (id === gate.context.user.id && parsed.data.isDisabled === true) {
    return NextResponse.json(
      { error: "Tidak dapat menonaktifkan akun yang sedang login." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
  }

  if (parsed.data.email && parsed.data.email !== user.email) {
    const clash = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true },
    });
    if (clash) {
      return NextResponse.json({ error: "Email sudah dipakai." }, { status: 409 });
    }
  }

  const data: {
    name?: string;
    email?: string;
    passwordHash?: string;
    isDisabled?: boolean;
    isSuperAdmin?: boolean;
  } = {};
  if (parsed.data.name) data.name = parsed.data.name;
  if (parsed.data.email) data.email = parsed.data.email;
  if (parsed.data.password) data.passwordHash = await hash(parsed.data.password, 12);
  if (parsed.data.isDisabled !== undefined) data.isDisabled = parsed.data.isDisabled;
  if (parsed.data.isSuperAdmin !== undefined) data.isSuperAdmin = parsed.data.isSuperAdmin;

  if (Object.keys(data).length > 0) {
    await prisma.user.update({ where: { id }, data });
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

export async function DELETE(_request: Request, context: RouteContext) {
  const gate = await requireSuperAdminApi();
  if (gate.error || !gate.context) return gate.error!;

  const { id } = await context.params;
  if (id === gate.context.user.id) {
    return NextResponse.json(
      { error: "Tidak dapat menghapus akun yang sedang login." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
  }

  await prisma.session.deleteMany({ where: { userId: id } });
  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
