import { NextResponse } from "next/server";
import { getCurrentSessionContext } from "@/lib/auth";
import { absoluteUrl } from "@/lib/app-url";
import { buildIcsMeeting } from "@/lib/calendar-links";
import { prisma } from "@/lib/db";
import { canViewMeeting } from "@/lib/meeting-access";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await getCurrentSessionContext();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;
  const meeting = await prisma.meeting.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      roomName: true,
      startsAt: true,
      organizationId: true,
      createdById: true,
      status: true,
    },
  });

  if (!meeting || !meeting.startsAt) {
    return NextResponse.json({ error: "Meeting tidak ditemukan." }, { status: 404 });
  }

  if (!canViewMeeting(session.user, meeting)) {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  const meetingUrl = await absoluteUrl(`/meeting/${meeting.roomName}`);
  const ics = buildIcsMeeting({
    uid: `${meeting.id}@genmeet`,
    title: meeting.title,
    description: `Meeting ${meeting.title} di GenMeet`,
    location: meetingUrl,
    startsAt: meeting.startsAt,
    url: meetingUrl,
  });

  const filename = `${meeting.roomName}.ics`;

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
