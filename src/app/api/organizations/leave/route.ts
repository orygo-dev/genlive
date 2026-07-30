import { NextResponse } from "next/server";
import { getCurrentSessionContext, setActiveOrganization } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { countOwners, writeAuditLog } from "@/lib/organization";

export const runtime = "nodejs";

export async function POST() {
  try {
    const context = await getCurrentSessionContext();
    if (!context?.activeMembership) {
      return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
    }

    const organizationId = context.activeMembership.organization.id;
    const membershipId = context.activeMembership.id;
    const role = context.activeMembership.role;

    if (role === "OWNER") {
      const owners = await countOwners(organizationId);
      if (owners <= 1) {
        return NextResponse.json(
          {
            error:
              "Owner terakhir tidak dapat keluar. Hapus workspace atau undang Owner lain terlebih dahulu.",
          },
          { status: 409 },
        );
      }
    }

    await writeAuditLog({
      organizationId,
      actorId: context.user.id,
      action: "member.left",
      targetType: "organization_member",
      targetId: membershipId,
      metadata: {
        memberEmail: context.user.email,
        previousRole: role,
      },
    });

    await prisma.organizationMember.delete({ where: { id: membershipId } });
    await prisma.session.updateMany({
      where: {
        userId: context.user.id,
        activeOrganizationId: organizationId,
      },
      data: { activeOrganizationId: null },
    });

    const remaining = await prisma.organizationMember.findFirst({
      where: { userId: context.user.id },
      orderBy: { joinedAt: "asc" },
      select: { organizationId: true },
    });

    if (remaining) {
      await setActiveOrganization(context.sessionId, remaining.organizationId);
    }

    return NextResponse.json({
      success: true,
      redirectTo: remaining ? "/dashboard" : "/dashboard/workspaces/new",
    });
  } catch (error) {
    console.error("Leave organization failed", error);
    return NextResponse.json(
      { error: "Belum dapat keluar dari workspace." },
      { status: 500 },
    );
  }
}
