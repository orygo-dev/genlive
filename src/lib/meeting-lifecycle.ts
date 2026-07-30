import type { MeetingStatus } from "@/generated/prisma/enums";

export function isParticipantRoomOpen(status: MeetingStatus) {
  return status === "ACTIVE";
}

export function isFutureStart(startsAt: Date, now = new Date()) {
  return startsAt.getTime() > now.getTime();
}

export function accumulateDuration(
  currentSeconds: number,
  joinedAt: Date | null,
  leftAt: Date,
) {
  if (!joinedAt) {
    return currentSeconds;
  }

  const elapsedSeconds = Math.max(
    0,
    Math.round((leftAt.getTime() - joinedAt.getTime()) / 1000),
  );
  return currentSeconds + elapsedSeconds;
}
