import { NextResponse } from "next/server";
import { z } from "zod";
import { absoluteUrl } from "@/lib/app-url";
import { getCurrentSessionContext } from "@/lib/auth";
import { assertCanInviteMember } from "@/lib/billing";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { buildMemberInviteEmail } from "@/lib/email-templates";
import {
  canManageMembers,
  createInviteToken,
  writeAuditLog,
} from "@/lib/organization";

export const runtime = "nodejs";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
});

const revokeSchema = z.object({
  invitationId: z.uuid(),
});

export async function GET() {
  const context = await getCurrentSessionContext();
  if (!context?.activeMembership) {
    return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  }

  if (!canManageMembers(context.activeMembership.role)) {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  const organizationId = context.activeMembership.organization.id;
  const now = new Date();

  await prisma.organizationInvitation.updateMany({
    where: {
      organizationId,
      status: "PENDING",
      expiresAt: { lte: now },
    },
    data: { status: "EXPIRED" },
  });

  const invitations = await prisma.organizationInvitation.findMany({
    where: {
      organizationId,
      status: { in: ["PENDING", "ACCEPTED", "REVOKED", "EXPIRED"] },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      expiresAt: true,
      acceptedAt: true,
      createdAt: true,
      invitedBy: { select: { name: true, email: true } },
    },
  });

  return NextResponse.json(
    { invitations },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  try {
    const context = await getCurrentSessionContext();
    if (!context?.activeMembership) {
      return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
    }

    if (!canManageMembers(context.activeMembership.role)) {
      return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
    }

    const payload: unknown = await request.json();
    const result = inviteSchema.safeParse(payload);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message ?? "Undangan tidak valid." },
        { status: 400 },
      );
    }

    if (
      context.activeMembership.role === "ADMIN" &&
      result.data.role === "ADMIN"
    ) {
      return NextResponse.json(
        { error: "Admin hanya dapat mengundang Member." },
        { status: 403 },
      );
    }

    const organizationId = context.activeMembership.organization.id;
    const memberQuota = await assertCanInviteMember(organizationId);
    if (!memberQuota.ok) {
      return NextResponse.json(
        { error: memberQuota.error },
        { status: memberQuota.status },
      );
    }

    const existingMember = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        user: { email: result.data.email },
      },
      select: { id: true },
    });

    if (existingMember) {
      return NextResponse.json(
        { error: "Email tersebut sudah menjadi anggota workspace." },
        { status: 409 },
      );
    }

    const pendingInvite = await prisma.organizationInvitation.findFirst({
      where: {
        organizationId,
        email: result.data.email,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });

    if (pendingInvite) {
      return NextResponse.json(
        { error: "Undangan untuk email tersebut masih aktif." },
        { status: 409 },
      );
    }

    const invite = createInviteToken();
    const invitation = await prisma.organizationInvitation.create({
      data: {
        organizationId,
        email: result.data.email,
        role: result.data.role,
        tokenHash: invite.tokenHash,
        invitedById: context.user.id,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    const acceptPath = `/invite/${invite.token}`;
    const inviteUrl = await absoluteUrl(acceptPath, new URL(request.url).origin);
    const template = buildMemberInviteEmail({
      organizationName: context.activeMembership.organization.name,
      inviterName: context.user.name,
      role: invitation.role,
      inviteUrl,
      expiresAt: invitation.expiresAt,
    });
    const emailResult = await sendEmail({
      to: invitation.email,
      ...template,
    });

    await writeAuditLog({
      organizationId,
      actorId: context.user.id,
      action: "invitation.created",
      targetType: "organization_invitation",
      targetId: invitation.id,
      metadata: {
        email: invitation.email,
        role: invitation.role,
        emailDelivery: emailResult.delivery,
        ...(!emailResult.ok && emailResult.error ? { emailError: emailResult.error } : {}),
      },
    });

    return NextResponse.json(
      {
        invitation,
        inviteUrl: acceptPath,
        delivery: emailResult.delivery,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Format data tidak valid." }, { status: 400 });
    }

    console.error("Create invitation failed", error);
    return NextResponse.json(
      { error: "Undangan belum dapat dibuat." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await getCurrentSessionContext();
    if (!context?.activeMembership) {
      return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
    }

    if (!canManageMembers(context.activeMembership.role)) {
      return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
    }

    const payload: unknown = await request.json();
    const result = revokeSchema.safeParse(payload);
    if (!result.success) {
      return NextResponse.json({ error: "Undangan tidak valid." }, { status: 400 });
    }

    const organizationId = context.activeMembership.organization.id;
    const update = await prisma.organizationInvitation.updateMany({
      where: {
        id: result.data.invitationId,
        organizationId,
        status: "PENDING",
      },
      data: { status: "REVOKED" },
    });

    if (update.count === 0) {
      return NextResponse.json(
        { error: "Undangan tidak ditemukan atau sudah diproses." },
        { status: 409 },
      );
    }

    await writeAuditLog({
      organizationId,
      actorId: context.user.id,
      action: "invitation.revoked",
      targetType: "organization_invitation",
      targetId: result.data.invitationId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Format data tidak valid." }, { status: 400 });
    }

    console.error("Revoke invitation failed", error);
    return NextResponse.json(
      { error: "Undangan belum dapat dibatalkan." },
      { status: 500 },
    );
  }
}
