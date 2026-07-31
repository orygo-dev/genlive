import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { getCurrentSessionContext, setActiveOrganization } from "@/lib/auth";
import {
  createOrganizationSchema,
  deleteOrganizationSchema,
  updateOrganizationSchema,
} from "@/lib/auth-validation";
import { prisma } from "@/lib/db";
import {
  canManageMembers,
  createOrganizationSlug,
  writeAuditLog,
} from "@/lib/organization";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const context = await getCurrentSessionContext();
    if (!context) {
      return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
    }

    const payload: unknown = await request.json();
    const parsed = createOrganizationSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Data workspace tidak valid." },
        { status: 400 },
      );
    }

    const organization = await prisma.organization.create({
      data: {
        name: parsed.data.name,
        slug: createOrganizationSlug(parsed.data.name),
        memberships: {
          create: {
            userId: context.user.id,
            role: "OWNER",
          },
        },
      },
      select: { id: true, name: true, slug: true },
    });

    await setActiveOrganization(context.sessionId, organization.id);
    await writeAuditLog({
      organizationId: organization.id,
      actorId: context.user.id,
      action: "organization.created",
      targetType: "organization",
      targetId: organization.id,
      metadata: { name: organization.name },
    });

    return NextResponse.json({ organization }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Format data tidak valid." }, { status: 400 });
    }

    console.error("Create organization failed", error);
    return NextResponse.json(
      { error: "Workspace belum dapat dibuat." },
      { status: 500 },
    );
  }
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
    const parsed = updateOrganizationSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Data workspace tidak valid." },
        { status: 400 },
      );
    }

    const organizationId = context.activeMembership.organization.id;
    const previousName = context.activeMembership.organization.name;

    const updateData: {
      name?: string;
      recordingRetentionDays?: number | null;
      brandName?: string | null;
      logoUrl?: string | null;
      primaryColor?: string | null;
      customDomain?: string | null;
      ssoEnabled?: boolean;
      ssoProvider?: string | null;
      ssoTenantHint?: string | null;
    } = {};

    if (parsed.data.name !== undefined) {
      updateData.name = parsed.data.name;
    }

    if (parsed.data.recordingRetentionDays !== undefined) {
      const value = parsed.data.recordingRetentionDays;
      updateData.recordingRetentionDays =
        value === 0 || value === null ? null : value;
    }

    if (parsed.data.brandName !== undefined) {
      updateData.brandName = parsed.data.brandName?.trim() || null;
    }

    if (parsed.data.logoUrl !== undefined) {
      updateData.logoUrl = parsed.data.logoUrl?.trim() || null;
    }

    if (parsed.data.primaryColor !== undefined) {
      updateData.primaryColor = parsed.data.primaryColor?.trim() || null;
    }

    if (parsed.data.customDomain !== undefined) {
      updateData.customDomain = parsed.data.customDomain?.trim().toLowerCase() || null;
    }

    if (parsed.data.ssoEnabled !== undefined) {
      updateData.ssoEnabled = parsed.data.ssoEnabled;
      updateData.ssoProvider = parsed.data.ssoEnabled ? "GOOGLE_WORKSPACE" : null;
    }

    if (parsed.data.ssoTenantHint !== undefined) {
      updateData.ssoTenantHint = parsed.data.ssoTenantHint?.trim() || null;
    }

    const organization = await prisma.organization.update({
      where: { id: organizationId },
      data: updateData,
      select: {
        id: true,
        name: true,
        slug: true,
        brandName: true,
        logoUrl: true,
        primaryColor: true,
        customDomain: true,
        ssoEnabled: true,
        ssoProvider: true,
        ssoTenantHint: true,
        recordingRetentionDays: true,
      },
    });

    await writeAuditLog({
      organizationId,
      actorId: context.user.id,
      action: "organization.updated",
      targetType: "organization",
      targetId: organizationId,
      metadata: {
        previousName,
        nextName: organization.name,
        recordingRetentionDays: organization.recordingRetentionDays,
        brandName: organization.brandName,
        ssoEnabled: organization.ssoEnabled,
        ssoTenantHint: organization.ssoTenantHint,
      },
    });

    return NextResponse.json({ organization });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Domain kustom sudah dipakai workspace lain." },
        { status: 409 },
      );
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Format data tidak valid." }, { status: 400 });
    }

    console.error("Update organization failed", error);
    return NextResponse.json(
      { error: "Workspace belum dapat diperbarui." },
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

    if (context.activeMembership.role !== "OWNER") {
      return NextResponse.json(
        { error: "Hanya Owner yang dapat menghapus workspace." },
        { status: 403 },
      );
    }

    const payload: unknown = await request.json();
    const parsed = deleteOrganizationSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Konfirmasi tidak valid." },
        { status: 400 },
      );
    }

    const organization = context.activeMembership.organization;
    if (parsed.data.confirmName !== organization.name) {
      return NextResponse.json(
        { error: "Nama konfirmasi tidak cocok dengan workspace." },
        { status: 400 },
      );
    }

    await writeAuditLog({
      organizationId: organization.id,
      actorId: context.user.id,
      action: "organization.deleted",
      targetType: "organization",
      targetId: organization.id,
      metadata: { name: organization.name },
    });

    await prisma.organization.delete({ where: { id: organization.id } });

    const remaining = await prisma.organizationMember.findFirst({
      where: { userId: context.user.id },
      orderBy: { joinedAt: "asc" },
      select: { organizationId: true },
    });

    if (remaining) {
      await setActiveOrganization(context.sessionId, remaining.organizationId);
    } else {
      await prisma.session.update({
        where: { id: context.sessionId },
        data: { activeOrganizationId: null },
      });
    }

    return NextResponse.json({
      success: true,
      redirectTo: remaining
        ? "/dashboard"
        : "/dashboard/workspaces/new",
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Format data tidak valid." }, { status: 400 });
    }

    console.error("Delete organization failed", error);
    return NextResponse.json(
      { error: "Workspace belum dapat dihapus." },
      { status: 500 },
    );
  }
}
