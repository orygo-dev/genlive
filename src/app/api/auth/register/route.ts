import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { createSession } from "@/lib/auth";
import { registerSchema } from "@/lib/auth-validation";
import { prisma } from "@/lib/db";
import { createOrganizationSlug } from "@/lib/organization-helpers";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
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
