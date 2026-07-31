import { NextResponse } from "next/server";
import { WebhookReceiver } from "livekit-server-sdk";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getLiveKitEnvironment } from "@/lib/livekit";
import { accumulateDuration } from "@/lib/meeting-lifecycle";
import { syncRecordingFromEgress } from "@/lib/recording";

export const runtime = "nodejs";

function eventTime(timestamp: bigint) {
  const milliseconds = Number(timestamp) * 1000;
  return milliseconds > 0 ? new Date(milliseconds) : new Date();
}

export async function POST(request: Request) {
  const environment = await getLiveKitEnvironment();
  const receiver = new WebhookReceiver(
    environment.LIVEKIT_API_KEY,
    environment.LIVEKIT_API_SECRET,
  );

  let event;
  try {
    const body = await request.text();
    event = await receiver.receive(body, request.headers.get("authorization") ?? undefined);
  } catch {
    return NextResponse.json({ error: "Webhook tidak valid." }, { status: 401 });
  }

  if (!event.id) {
    return NextResponse.json({ error: "Event ID tidak tersedia." }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.liveKitWebhookEvent.create({
        data: { eventId: event.id, eventType: event.event },
      });

      if (
        event.event === "egress_started" ||
        event.event === "egress_updated" ||
        event.event === "egress_ended"
      ) {
        return;
      }

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

    if (
      event.event === "egress_started" ||
      event.event === "egress_updated" ||
      event.event === "egress_ended"
    ) {
      const egressInfo = event.egressInfo;
      if (egressInfo) {
        await syncRecordingFromEgress(egressInfo);
      }
    }

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
