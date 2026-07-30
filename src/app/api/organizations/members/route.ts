import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSessionContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  canManageMembers,
  countOwners,
  writeAuditLog,
} from "@/lib/organization";

export const runtime = "nodejs";

const updateRoleSchema = z.object({
  memberId: z.uuid(),
  role: z.enum(["OWNER", "ADMIN", "MEMBER"]),
});

const removeMemberSchema = z.object({
  memberId: z.uuid(),
});

export async function GET() {
  const context = await getCurrentSessionContext();
  if (!context?.activeMembership) {
    return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  }

  const organizationId = context.activeMembership.organization.id;
  const members = await prisma.organizationMember.findMany({
    where: { organizationId },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    select: {
      id: true,
      role: true,
      joinedAt: true,
      user: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  return NextResponse.json(
    {
      organization: context.activeMembership.organization,
      currentRole: context.activeMembership.role,
      members,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(request: Request) {
  try {
    const context = await getCurrentSessionContext();
    if (!context?.activeMembership) {
      return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
    }

    if (!canManageMembers(context.activeMembership.role)) {
      return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
    }

    const payload: unknown = await request.json();
    const result = updateRoleSchema.safeParse(payload);
    if (!result.success) {
      return NextResponse.json({ error: "Data peran tidak valid." }, { status: 400 });
    }

    const organizationId = context.activeMembership.organization.id;
    const target = await prisma.organizationMember.findFirst({
      where: { id: result.data.memberId, organizationId },
      select: {
        id: true,
        role: true,
        userId: true,
        user: { select: { email: true, name: true } },
      },
    });

    if (!target) {
      return NextResponse.json({ error: "Anggota tidak ditemukan." }, { status: 404 });
    }

    if (
      context.activeMembership.role === "ADMIN" &&
      (target.role !== "MEMBER" || result.data.role !== "MEMBER")
    ) {
      return NextResponse.json(
        { error: "Admin hanya dapat mengelola Member." },
        { status: 403 },
      );
    }

    if (target.role === "OWNER" && result.data.role !== "OWNER") {
      const owners = await countOwners(organizationId);
      if (owners <= 1) {
        return NextResponse.json(
          { error: "Organisasi harus memiliki minimal satu Owner." },
          { status: 409 },
        );
      }
    }

    const updated = await prisma.organizationMember.update({
      where: { id: target.id },
      data: { role: result.data.role },
      select: {
        id: true,
        role: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });

    await writeAuditLog({
      organizationId,
      actorId: context.user.id,
      action: "member.role_updated",
      targetType: "organization_member",
      targetId: target.id,
      metadata: {
        previousRole: target.role,
        nextRole: result.data.role,
        memberEmail: target.user.email,
      },
    });

    return NextResponse.json({ member: updated });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Format data tidak valid." }, { status: 400 });
    }

    console.error("Update member role failed", error);
    return NextResponse.json(
      { error: "Peran anggota belum dapat diperbarui." },
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
    const result = removeMemberSchema.safeParse(payload);
    if (!result.success) {
      return NextResponse.json({ error: "Data anggota tidak valid." }, { status: 400 });
    }

    const organizationId = context.activeMembership.organization.id;
    const target = await prisma.organizationMember.findFirst({
      where: { id: result.data.memberId, organizationId },
      select: {
        id: true,
        role: true,
        userId: true,
        user: { select: { email: true, name: true } },
      },
    });

    if (!target) {
      return NextResponse.json({ error: "Anggota tidak ditemukan." }, { status: 404 });
    }

    if (target.userId === context.user.id) {
      return NextResponse.json(
        { error: "Anda tidak dapat menghapus diri sendiri dari sini." },
        { status: 409 },
      );
    }

    if (
      context.activeMembership.role === "ADMIN" &&
      (target.role === "OWNER" || target.role === "ADMIN")
    ) {
      return NextResponse.json(
        { error: "Admin hanya dapat menghapus Member." },
        { status: 403 },
      );
    }

    if (target.role === "OWNER") {
      const owners = await countOwners(organizationId);
      if (owners <= 1) {
        return NextResponse.json(
          { error: "Owner terakhir tidak dapat dihapus." },
          { status: 409 },
        );
      }
    }

    await prisma.organizationMember.delete({ where: { id: target.id } });
    await prisma.session.updateMany({
      where: {
        userId: target.userId,
        activeOrganizationId: organizationId,
      },
      data: { activeOrganizationId: null },
    });

    await writeAuditLog({
      organizationId,
      actorId: context.user.id,
      action: "member.removed",
      targetType: "organization_member",
      targetId: target.id,
      metadata: {
        memberEmail: target.user.email,
        previousRole: target.role,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Format data tidak valid." }, { status: 400 });
    }

    console.error("Remove member failed", error);
    return NextResponse.json(
      { error: "Anggota belum dapat dihapus." },
      { status: 500 },
    );
  }
}
