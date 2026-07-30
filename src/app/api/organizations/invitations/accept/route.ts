import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getCurrentSessionContext,
  setActiveOrganization,
} from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hashInviteToken, writeAuditLog } from "@/lib/organization";

export const runtime = "nodejs";

const acceptSchema = z.object({
  token: z.string().min(20).max(120),
});

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const result = acceptSchema.safeParse({ token });
  if (!result.success) {
    return NextResponse.json({ error: "Token undangan tidak valid." }, { status: 400 });
  }

  const invitation = await prisma.organizationInvitation.findUnique({
    where: { tokenHash: hashInviteToken(result.data.token) },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      expiresAt: true,
      organization: { select: { id: true, name: true } },
      invitedBy: { select: { name: true } },
    },
  });

  if (!invitation) {
    return NextResponse.json({ error: "Undangan tidak ditemukan." }, { status: 404 });
  }

  if (invitation.status === "PENDING" && invitation.expiresAt <= new Date()) {
    await prisma.organizationInvitation.update({
      where: { id: invitation.id },
      data: { status: "EXPIRED" },
    });
    return NextResponse.json({ error: "Undangan sudah kedaluwarsa." }, { status: 410 });
  }

  if (invitation.status !== "PENDING") {
    return NextResponse.json(
      { error: "Undangan sudah tidak aktif.", status: invitation.status },
      { status: 409 },
    );
  }

  return NextResponse.json(
    {
      invitation: {
        email: invitation.email,
        role: invitation.role,
        organizationName: invitation.organization.name,
        invitedByName: invitation.invitedBy.name,
        expiresAt: invitation.expiresAt,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  try {
    const payload: unknown = await request.json();
    const result = acceptSchema.safeParse(payload);
    if (!result.success) {
      return NextResponse.json({ error: "Token undangan tidak valid." }, { status: 400 });
    }

    const context = await getCurrentSessionContext();
    if (!context) {
      return NextResponse.json(
        { error: "Silakan masuk dengan akun yang diundang terlebih dahulu." },
        { status: 401 },
      );
    }

    const invitation = await prisma.organizationInvitation.findUnique({
      where: { tokenHash: hashInviteToken(result.data.token) },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        expiresAt: true,
        organizationId: true,
        organization: { select: { id: true, name: true, slug: true } },
      },
    });

    if (!invitation) {
      return NextResponse.json({ error: "Undangan tidak ditemukan." }, { status: 404 });
    }

    if (invitation.status === "PENDING" && invitation.expiresAt <= new Date()) {
      await prisma.organizationInvitation.update({
        where: { id: invitation.id },
        data: { status: "EXPIRED" },
      });
      return NextResponse.json({ error: "Undangan sudah kedaluwarsa." }, { status: 410 });
    }

    if (invitation.status !== "PENDING") {
      return NextResponse.json(
        { error: "Undangan sudah tidak aktif." },
        { status: 409 },
      );
    }

    if (context.user.email !== invitation.email) {
      return NextResponse.json(
        {
          error:
            "Masuk dengan email yang diundang untuk menerima undangan ini.",
        },
        { status: 403 },
      );
    }

    const existing = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: invitation.organizationId,
          userId: context.user.id,
        },
      },
      select: { id: true },
    });

    await prisma.$transaction(async (transaction) => {
      if (!existing) {
        await transaction.organizationMember.create({
          data: {
            organizationId: invitation.organizationId,
            userId: context.user.id,
            role: invitation.role,
          },
        });
      }

      await transaction.organizationInvitation.update({
        where: { id: invitation.id },
        data: {
          status: "ACCEPTED",
          acceptedAt: new Date(),
        },
      });
    });

    await setActiveOrganization(context.sessionId, invitation.organizationId);
    await writeAuditLog({
      organizationId: invitation.organizationId,
      actorId: context.user.id,
      action: "invitation.accepted",
      targetType: "organization_invitation",
      targetId: invitation.id,
      metadata: {
        email: invitation.email,
        role: invitation.role,
      },
    });

    return NextResponse.json({
      organization: invitation.organization,
      role: invitation.role,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Format data tidak valid." }, { status: 400 });
    }

    console.error("Accept invitation failed", error);
    return NextResponse.json(
      { error: "Undangan belum dapat diterima." },
      { status: 500 },
    );
  }
}
