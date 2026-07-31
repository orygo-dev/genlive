import { NextResponse } from "next/server";
import { getCurrentSessionContext } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const context = await getCurrentSessionContext();
    if (!context?.activeMembership) {
      return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
    }

    if (context.activeMembership.role !== "OWNER") {
      return NextResponse.json(
        { error: "Hanya Owner yang dapat mengekspor data workspace." },
        { status: 403 },
      );
    }

    const organizationId = context.activeMembership.organization.id;
    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        slug: true,
        brandName: true,
        planCode: true,
        planExpiresAt: true,
        recordingRetentionDays: true,
        createdAt: true,
        updatedAt: true,
        memberships: {
          select: {
            role: true,
            joinedAt: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                emailVerifiedAt: true,
                createdAt: true,
              },
            },
          },
          orderBy: { joinedAt: "asc" },
        },
        meetings: {
          select: {
            id: true,
            title: true,
            roomName: true,
            status: true,
            waitingRoom: true,
            startsAt: true,
            actualStartedAt: true,
            endedAt: true,
            createdAt: true,
            updatedAt: true,
            createdBy: { select: { id: true, email: true, name: true } },
            _count: { select: { participants: true, recordings: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    const exportedAt = new Date().toISOString();
    const filename = `data-export-${organization.slug}-${exportedAt.slice(0, 10)}.json`;

    return NextResponse.json(
      {
        exportedAt,
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          brandName: organization.brandName,
          planCode: organization.planCode,
          planExpiresAt: organization.planExpiresAt,
          recordingRetentionDays: organization.recordingRetentionDays,
          createdAt: organization.createdAt,
          updatedAt: organization.updatedAt,
        },
        members: organization.memberships.map((membership) => ({
          role: membership.role,
          joinedAt: membership.joinedAt,
          user: membership.user,
        })),
        meetings: organization.meetings.map((meeting) => ({
          id: meeting.id,
          title: meeting.title,
          roomName: meeting.roomName,
          status: meeting.status,
          waitingRoom: meeting.waitingRoom,
          startsAt: meeting.startsAt,
          actualStartedAt: meeting.actualStartedAt,
          endedAt: meeting.endedAt,
          createdAt: meeting.createdAt,
          updatedAt: meeting.updatedAt,
          createdBy: meeting.createdBy,
          participantCount: meeting._count.participants,
          recordingCount: meeting._count.recordings,
        })),
        note: "Ekspor metadata saja — file rekaman tidak disertakan.",
      },
      {
        headers: {
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      },
    );
  } catch (error) {
    console.error("Data export failed", error);
    return NextResponse.json(
      { error: "Ekspor data workspace gagal." },
      { status: 500 },
    );
  }
}
