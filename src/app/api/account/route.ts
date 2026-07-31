import { NextResponse } from "next/server";
import {
  deleteCurrentSession,
  getCurrentSessionContext,
} from "@/lib/auth";
import { deleteAccountSchema, updateProfileSchema } from "@/lib/auth-validation";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/organization";

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

export async function DELETE(request: Request) {
  try {
    const context = await getCurrentSessionContext();
    if (!context) {
      return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
    }

    const payload: unknown = await request.json();
    const parsed = deleteAccountSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Konfirmasi tidak valid." },
        { status: 400 },
      );
    }

    if (parsed.data.confirmEmail !== context.user.email) {
      return NextResponse.json(
        { error: "Email konfirmasi tidak cocok dengan akun Anda." },
        { status: 400 },
      );
    }

    const memberships = await prisma.organizationMember.findMany({
      where: { userId: context.user.id },
      select: {
        role: true,
        organizationId: true,
        organization: {
          select: {
            id: true,
            name: true,
            _count: { select: { memberships: true } },
          },
        },
      },
    });

    const blockingOrgs: string[] = [];
    const emptyOwnedOrgIds: string[] = [];

    for (const membership of memberships) {
      const memberCount = membership.organization._count.memberships;
      if (membership.role === "OWNER" && memberCount > 1) {
        blockingOrgs.push(membership.organization.name);
      } else if (memberCount === 1) {
        emptyOwnedOrgIds.push(membership.organizationId);
      }
    }

    if (blockingOrgs.length > 0) {
      return NextResponse.json(
        {
          error:
            "Anda masih Owner satu-satunya di workspace dengan anggota lain. Transfer ownership atau hapus workspace terlebih dahulu.",
          organizations: blockingOrgs,
        },
        { status: 409 },
      );
    }

    for (const orgId of emptyOwnedOrgIds) {
      try {
        await writeAuditLog({
          organizationId: orgId,
          actorId: context.user.id,
          action: "organization.deleted",
          targetType: "organization",
          targetId: orgId,
          metadata: { reason: "account_deletion_auto" },
        });
      } catch {
        // Fail soft if org already gone or audit unavailable.
      }
      await prisma.organization.delete({ where: { id: orgId } }).catch(() => undefined);
    }

    await deleteCurrentSession();
    await prisma.user.delete({ where: { id: context.user.id } });

    return NextResponse.json({ success: true, redirectTo: "/" });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Format data tidak valid." }, { status: 400 });
    }

    console.error("Delete account failed", error);
    return NextResponse.json(
      { error: "Akun belum dapat dihapus." },
      { status: 500 },
    );
  }
}
