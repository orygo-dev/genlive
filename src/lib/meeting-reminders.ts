import "server-only";

import { absoluteUrl } from "@/lib/app-url";
import { prisma } from "@/lib/db";
import { isWhatsAppConfigured, sendWhatsAppMessage } from "@/lib/whatsapp";
import { buildMeetingReminderWhatsApp } from "@/lib/whatsapp-templates";

const WINDOW_MS = 15 * 60 * 1000;

function windowForOffset(now: Date, offsetMs: number) {
  const center = now.getTime() + offsetMs;
  return {
    from: new Date(center - WINDOW_MS),
    to: new Date(center + 60_000),
  };
}

export async function processMeetingReminders(now = new Date()) {
  if (!(await isWhatsAppConfigured())) {
    return {
      skipped: true,
      reason: "WhatsApp (Fonnte) belum dikonfigurasi.",
      sent: 0,
      failed: 0,
    };
  }

  const kinds = [
    { kind: "T_MINUS_24H" as const, offsetMs: 24 * 60 * 60 * 1000 },
    { kind: "T_MINUS_1H" as const, offsetMs: 60 * 60 * 1000 },
  ];

  let sent = 0;
  let failed = 0;
  const details: Array<{
    meetingId: string;
    kind: string;
    recipient: string;
    status: string;
  }> = [];

  for (const item of kinds) {
    const range = windowForOffset(now, item.offsetMs);
    const meetings = await prisma.meeting.findMany({
      where: {
        status: "SCHEDULED",
        startsAt: {
          gte: range.from,
          lte: range.to,
        },
      },
      select: {
        id: true,
        title: true,
        roomName: true,
        startsAt: true,
        waitingRoom: true,
        passwordHash: true,
        organization: { select: { name: true } },
        createdBy: { select: { name: true } },
        invites: {
          where: { channel: "WHATSAPP" },
          select: { recipient: true, phoneE164: true },
        },
      },
    });

    for (const meeting of meetings) {
      const inviteUrl = await absoluteUrl(`/meeting/${meeting.roomName}`);
      for (const invite of meeting.invites) {
        const recipient = invite.phoneE164 || invite.recipient;
        const existing = await prisma.reminderSent.findUnique({
          where: {
            meetingId_kind_channel_recipient: {
              meetingId: meeting.id,
              kind: item.kind,
              channel: "WHATSAPP",
              recipient,
            },
          },
          select: { id: true },
        });
        if (existing) {
          continue;
        }

        const message = buildMeetingReminderWhatsApp({
          kind: item.kind,
          meetingTitle: meeting.title,
          hostName: meeting.createdBy.name,
          organizationName: meeting.organization.name,
          meetingUrl: inviteUrl,
          startsAt: meeting.startsAt,
          waitingRoom: meeting.waitingRoom,
          passwordRequired: Boolean(meeting.passwordHash),
        });

        const result = await sendWhatsAppMessage({
          target: recipient,
          message,
        });

        await prisma.reminderSent.create({
          data: {
            meetingId: meeting.id,
            kind: item.kind,
            channel: "WHATSAPP",
            recipient,
            providerRef: result.ok ? result.id : null,
            status: result.ok ? "sent" : "failed",
          },
        });

        details.push({
          meetingId: meeting.id,
          kind: item.kind,
          recipient,
          status: result.ok ? "sent" : "failed",
        });

        if (result.ok) {
          sent += 1;
        } else {
          failed += 1;
        }
      }
    }
  }

  return { skipped: false, sent, failed, details };
}
