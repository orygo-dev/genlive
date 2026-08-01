import { MeetingLeftScreen } from "@/components/meeting-left-screen";

export const dynamic = "force-dynamic";

type MeetingLeftPageProps = {
  searchParams: Promise<{
    room?: string;
    title?: string;
    role?: string;
  }>;
};

export default async function MeetingLeftPage({
  searchParams,
}: MeetingLeftPageProps) {
  const params = await searchParams;
  const role =
    params.role === "HOST" ||
    params.role === "MODERATOR" ||
    params.role === "PARTICIPANT"
      ? params.role
      : null;

  return (
    <MeetingLeftScreen
      roomName={params.room ?? null}
      title={params.title ?? null}
      role={role}
    />
  );
}
