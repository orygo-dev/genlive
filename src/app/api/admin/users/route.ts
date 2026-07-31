import { randomUUID } from "node:crypto";
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
export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: displayNameSchema,
  email: emailSchema,
  password: passwordSchema,
  isSuperAdmin: z.boolean().optional(),
});

export async function GET(request: Request) {
  const { context, error } = await requireSuperAdminApi();
  if (error || !context) return error!;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || "";
  const take = Math.min(Number(searchParams.get("take") || 50), 100);

  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [{ email: { contains: q } }, { name: { contains: q } }],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      name: true,
      email: true,
      isSuperAdmin: true,
      isDisabled: true,
      createdAt: true,
      memberships: {
        select: {
          role: true,
          organization: {
            select: { id: true, name: true, planCode: true },
          },
        },
      },
      _count: { select: { sessions: true } },
    },
  });

  return NextResponse.json({
    users: users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
      isDisabled: user.isDisabled,
      createdAt: user.createdAt,
      sessionCount: user._count.sessions,
      organizations: user.memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        planCode: m.organization.planCode,
        role: m.role,
      })),
    })),
  });
}

export async function POST(request: Request) {
  const gate = await requireSuperAdminApi();
  if (gate.error || !gate.context) return gate.error!;

  const payload: unknown = await request.json();
  const parsed = createSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: "Email sudah terdaftar." }, { status: 409 });
  }

  const passwordHash = await hash(parsed.data.password, 12);
  const user = await prisma.user.create({
    data: {
      id: randomUUID(),
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      isSuperAdmin: parsed.data.isSuperAdmin ?? false,
    },
    select: {
      id: true,
      name: true,
      email: true,
      isSuperAdmin: true,
      isDisabled: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ user }, { status: 201 });
}
