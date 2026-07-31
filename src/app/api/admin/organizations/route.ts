import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdminApi } from "@/lib/admin-api";
import { organizationNameSchema } from "@/lib/auth-validation";
import { resolveOrganizationPlan } from "@/lib/billing";
import { prisma } from "@/lib/db";
import { createOrganizationSlug, writeAuditLog } from "@/lib/organization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: organizationNameSchema,
  ownerUserId: z.string().uuid().optional(),
  ownerEmail: z.string().email().optional(),
  planCode: z.enum(["FREE", "PRO"]).optional(),
});

export async function GET(request: Request) {
  const { context, error } = await requireSuperAdminApi();
  if (error || !context) return error!;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || "";
  const take = Math.min(Number(searchParams.get("take") || 50), 100);

  const organizations = await prisma.organization.findMany({
    where: q
      ? {
          OR: [{ name: { contains: q } }, { slug: { contains: q } }],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      name: true,
      slug: true,
      planCode: true,
      planExpiresAt: true,
      createdAt: true,
      _count: {
        select: {
          memberships: true,
          meetings: true,
        },
      },
    },
  });

  const items = await Promise.all(
    organizations.map(async (org) => {
      const resolved = await resolveOrganizationPlan(org.id);
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        planCode: resolved?.planCode ?? org.planCode,
        planExpiresAt: resolved?.planExpiresAt ?? org.planExpiresAt,
        planName: resolved?.plan.name ?? org.planCode,
        memberCount: org._count.memberships,
        meetingCount: org._count.meetings,
        createdAt: org.createdAt,
      };
    }),
  );

  return NextResponse.json({ organizations: items });
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

  let ownerId = parsed.data.ownerUserId;
  if (!ownerId && parsed.data.ownerEmail) {
    const owner = await prisma.user.findUnique({
      where: { email: parsed.data.ownerEmail.trim().toLowerCase() },
      select: { id: true },
    });
    if (!owner) {
      return NextResponse.json(
        { error: "Owner email tidak ditemukan." },
        { status: 404 },
      );
    }
    ownerId = owner.id;
  }
  if (!ownerId) {
    ownerId = gate.context.user.id;
  }

  const organization = await prisma.organization.create({
    data: {
      name: parsed.data.name,
      slug: createOrganizationSlug(parsed.data.name),
      planCode: parsed.data.planCode ?? "FREE",
      memberships: {
        create: {
          userId: ownerId,
          role: "OWNER",
        },
      },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      planCode: true,
      planExpiresAt: true,
      createdAt: true,
    },
  });

  await writeAuditLog({
    organizationId: organization.id,
    actorId: gate.context.user.id,
    action: "organization.created",
    targetType: "organization",
    targetId: organization.id,
    metadata: { via: "super_admin" },
  });

  return NextResponse.json({ organization }, { status: 201 });
}
