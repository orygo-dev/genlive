import { notFound } from "next/navigation";
import { MeetingExperience } from "@/components/meeting-experience";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { meetingRequestSchema } from "@/lib/meeting";

export const dynamic = "force-dynamic";

type MeetingPageProps = {
  params: Promise<{ roomName: string }>;
};

export default async function MeetingPage({ params }: MeetingPageProps) {
  const { roomName } = await params;
  const result = meetingRequestSchema.shape.roomName.safeParse(roomName);

  if (!result.success) {
    notFound();
  }

  const meeting = await prisma.meeting.findUnique({
    where: { roomName: result.data },
    select: {
      id: true,
      title: true,
      passwordHash: true,
      waitingRoom: true,
      startsAt: true,
      status: true,
      createdById: true,
      organizationId: true,
    },
  });
  const user = await getCurrentUser();
  const membership = meeting
    ? user?.memberships.find(
        (item) => item.organization.id === meeting.organizationId,
      )
    : undefined;
  const canModerate =
    Boolean(meeting && user?.id === meeting.createdById) ||
    membership?.role === "OWNER" ||
    membership?.role === "ADMIN";

  return (
    <MeetingExperience
      roomName={result.data}
      meetingConfig={
        meeting
          ? {
              id: meeting.id,
              title: meeting.title,
              passwordRequired: Boolean(meeting.passwordHash) && !canModerate,
              waitingRoom: meeting.waitingRoom && !canModerate,
              startsAt: meeting.startsAt?.toISOString() ?? null,
              status: meeting.status,
            }
          : null
      }
    />
  );
}
