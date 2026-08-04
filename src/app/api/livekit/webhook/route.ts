import { NextResponse } from "next/server";
import { WebhookReceiver } from "livekit-server-sdk";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getLiveKitServerProfiles } from "@/lib/livekit";
import { accumulateDuration } from "@/lib/meeting-lifecycle";
import { syncRecordingFromEgress } from "@/lib/recording";

export const runtime = "nodejs";

function eventTime(timestamp: bigint) {
  const milliseconds = Number(timestamp) * 1000;
  return milliseconds > 0 ? new Date(milliseconds) : new Date();
}

export async function POST(request: Request) {
  let event;
  try {
    const body = await request.text();
    const authorization = request.headers.get("authorization") ?? undefined;
    const profiles = await getLiveKitServerProfiles();
    for (const profile of profiles) {
      try {
        const receiver = new WebhookReceiver(profile.apiKey, profile.apiSecret);
        event = await receiver.receive(body, authorization);
        break;
      } catch {
        // Try the next configured server. Each profile has an independent secret.
      }
    }
    if (!event) throw new Error("No LiveKit profile accepted this webhook.");
  } catch {
    return NextResponse.json({ error: "Webhook tidak valid." }, { status: 401 });
  }

  if (!event.id) {
    return NextResponse.json({ error: "Event ID tidak tersedia." }, { status: 400 });
  }

  const isEgressEvent =
    event.event === "egress_started" ||
    event.event === "egress_updated" ||
    event.event === "egress_ended";

  try {
    // Persist the recording state before marking the webhook as processed.
    // If the database write fails, LiveKit can retry this event safely.
    if (isEgressEvent) {
      if (event.egressInfo) {
        await syncRecordingFromEgress(event.egressInfo);
      }
      await prisma.liveKitWebhookEvent.create({
        data: { eventId: event.id, eventType: event.event },
      });
      return NextResponse.json({ received: true });
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.liveKitWebhookEvent.create({
        data: { eventId: event.id, eventType: event.event },
      });

      const roomName = event.room?.name;
      if (!roomName) {
        return;
      }

      if (event.event === "room_started") {
        const startedAt = eventTime(event.createdAt);
        await transaction.meeting.updateMany({
          where: { roomName, status: "SCHEDULED" },
          data: { status: "ACTIVE" },
        });
        await transaction.meeting.updateMany({
          where: { roomName, actualStartedAt: null },
          data: { actualStartedAt: startedAt },
        });
        return;
      }

      if (event.event === "room_finished") {
        const endedAt = eventTime(event.createdAt);
        const meeting = await transaction.meeting.findUnique({
          where: { roomName },
          select: {
            status: true,
            actualStartedAt: true,
            startsAt: true,
          },
        });

        // Grace: brief empty room (Strict Mode / reconnect) must not ENDED the meeting.
        if (
          meeting &&
          (meeting.status === "SCHEDULED" || meeting.status === "ACTIVE")
        ) {
          const startedAt = meeting.actualStartedAt ?? meeting.startsAt;
          if (startedAt) {
            const ageMs = endedAt.getTime() - startedAt.getTime();
            if (ageMs >= 0 && ageMs < 90_000) {
              return;
            }
          }
        }

        await transaction.meeting.updateMany({
          where: {
            roomName,
            status: { in: ["SCHEDULED", "ACTIVE"] },
          },
          data: { status: "ENDED", endedAt },
        });
        const openParticipants = await transaction.meetingParticipant.findMany({
          where: {
            meeting: { roomName },
            admissionStatus: "ADMITTED",
            joinedAt: { not: null },
            leftAt: null,
          },
          select: { id: true, joinedAt: true, durationSeconds: true },
        });
        for (const participant of openParticipants) {
          if (!participant.joinedAt) continue;
          await transaction.meetingParticipant.update({
            where: { id: participant.id },
            data: {
              leftAt: endedAt,
              durationSeconds: accumulateDuration(
                participant.durationSeconds,
                participant.joinedAt,
                endedAt,
              ),
            },
          });
        }

        await transaction.recording.updateMany({
          where: {
            meeting: { roomName },
            status: { in: ["STARTING", "ACTIVE"] },
          },
          data: { status: "ENDING" },
        });
        return;
      }

      const identity = event.participant?.identity;
      if (!identity) {
        return;
      }

      const meeting = await transaction.meeting.findUnique({
        where: { roomName },
        select: { id: true, status: true, endedAt: true },
      });
      if (!meeting) {
        return;
      }

      if (event.event === "participant_joined") {
        const joinedAt = eventTime(event.createdAt);
        if (meeting.status === "ENDED" || meeting.status === "CANCELLED") {
          const existing = await transaction.meetingParticipant.findUnique({
            where: {
              meetingId_livekitIdentity: {
                meetingId: meeting.id,
                livekitIdentity: identity,
              },
            },
            select: {
              id: true,
              joinedAt: true,
              leftAt: true,
              durationSeconds: true,
            },
          });
          if (existing?.joinedAt) {
            const terminalLeftAt = meeting.endedAt ?? joinedAt;
            if (
              existing.leftAt &&
              joinedAt.getTime() > existing.leftAt.getTime() &&
              terminalLeftAt.getTime() >= joinedAt.getTime()
            ) {
              await transaction.meetingParticipant.update({
                where: { id: existing.id },
                data: {
                  joinedAt,
                  leftAt: terminalLeftAt,
                  durationSeconds: accumulateDuration(
                    existing.durationSeconds,
                    joinedAt,
                    terminalLeftAt,
                  ),
                },
              });
            }
            return;
          }

          const leftAt = meeting.endedAt ?? joinedAt;
          await transaction.meetingParticipant.upsert({
            where: {
              meetingId_livekitIdentity: {
                meetingId: meeting.id,
                livekitIdentity: identity,
              },
            },
            create: {
              meetingId: meeting.id,
              livekitIdentity: identity,
              displayName: event.participant?.name || identity,
              admissionStatus: "ADMITTED",
              joinedAt,
              leftAt,
              durationSeconds: accumulateDuration(0, joinedAt, leftAt),
            },
            update: {
              displayName: event.participant?.name || identity,
              admissionStatus: "ADMITTED",
              joinedAt,
              leftAt,
              durationSeconds: accumulateDuration(
                existing?.durationSeconds ?? 0,
                joinedAt,
                leftAt,
              ),
            },
          });
          return;
        }

        await transaction.meetingParticipant.upsert({
          where: {
            meetingId_livekitIdentity: {
              meetingId: meeting.id,
              livekitIdentity: identity,
            },
          },
          create: {
            meetingId: meeting.id,
            livekitIdentity: identity,
            displayName: event.participant?.name || identity,
            admissionStatus: "ADMITTED",
            joinedAt,
          },
          update: {
            displayName: event.participant?.name || identity,
            admissionStatus: "ADMITTED",
            joinedAt,
            leftAt: null,
          },
        });
        return;
      }

      if (meeting.status === "ENDED" || meeting.status === "CANCELLED") {
        return;
      }

      if (
        event.event === "participant_left" ||
        event.event === "participant_connection_aborted"
      ) {
        const participant = await transaction.meetingParticipant.findUnique({
          where: {
            meetingId_livekitIdentity: {
              meetingId: meeting.id,
              livekitIdentity: identity,
            },
          },
          select: {
            id: true,
            joinedAt: true,
            leftAt: true,
            durationSeconds: true,
          },
        });

        if (
          participant?.joinedAt &&
          participant.leftAt === null
        ) {
          const leftAt = eventTime(event.createdAt);
          if (leftAt.getTime() < participant.joinedAt.getTime()) {
            return;
          }
          const durationSeconds = accumulateDuration(
            participant.durationSeconds,
            participant.joinedAt,
            leftAt,
          );
          await transaction.meetingParticipant.update({
            where: { id: participant.id },
            data: { leftAt, durationSeconds },
          });
        }
      }
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    console.error("LiveKit webhook processing failed", error);
    return NextResponse.json({ error: "Webhook gagal diproses." }, { status: 500 });
  }
}
