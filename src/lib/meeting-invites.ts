import "server-only";

import { absoluteUrl } from "@/lib/app-url";
import { prisma } from "@/lib/db";
import { sendEmail, summarizeDeliveries, type SendEmailResult } from "@/lib/email";
import { buildMeetingInviteEmail } from "@/lib/email-templates";
import {
  sendWhatsAppMessage,
  summarizeWhatsAppDeliveries,
  type SendWhatsAppResult,
} from "@/lib/whatsapp";
import { buildMeetingInviteWhatsApp } from "@/lib/whatsapp-templates";

type MeetingInviteTarget = {
  id: string;
  title: string;
  roomName: string;
  startsAt: Date | null;
  waitingRoom: boolean;
  passwordHash: string | null;
  organization: { name: string };
};

export async function deliverMeetingInvites(input: {
  meeting: MeetingInviteTarget;
  hostName: string;
  emails: string[];
  phones: string[];
  requestOrigin: string;
}) {
  const invitePath = `/meeting/${input.meeting.roomName}`;
  const inviteUrl = absoluteUrl(invitePath, input.requestOrigin);
  const common = {
    meetingTitle: input.meeting.title,
    hostName: input.hostName,
    organizationName: input.meeting.organization.name,
    meetingUrl: inviteUrl,
    startsAt: input.meeting.startsAt,
    waitingRoom: input.meeting.waitingRoom,
    passwordRequired: Boolean(input.meeting.passwordHash),
  };

  const emailResults: SendEmailResult[] = [];
  for (const email of input.emails) {
    const template = buildMeetingInviteEmail(common);
    const result = await sendEmail({ to: email, ...template });
    emailResults.push(result);

    await prisma.meetingInvite.upsert({
      where: {
        meetingId_channel_recipient: {
          meetingId: input.meeting.id,
          channel: "EMAIL",
          recipient: email,
        },
      },
      create: {
        meetingId: input.meeting.id,
        channel: "EMAIL",
        recipient: email,
        email,
      },
      update: {},
    });
  }

  const whatsappResults: SendWhatsAppResult[] = [];
  for (const phone of input.phones) {
    const message = buildMeetingInviteWhatsApp(common);
    const result = await sendWhatsAppMessage({ target: phone, message });
    whatsappResults.push(result);

    await prisma.meetingInvite.upsert({
      where: {
        meetingId_channel_recipient: {
          meetingId: input.meeting.id,
          channel: "WHATSAPP",
          recipient: phone,
        },
      },
      create: {
        meetingId: input.meeting.id,
        channel: "WHATSAPP",
        recipient: phone,
        phoneE164: phone,
      },
      update: {},
    });

    if (result.ok) {
      await prisma.reminderSent.upsert({
        where: {
          meetingId_kind_channel_recipient: {
            meetingId: input.meeting.id,
            kind: "INVITE",
            channel: "WHATSAPP",
            recipient: phone,
          },
        },
        create: {
          meetingId: input.meeting.id,
          kind: "INVITE",
          channel: "WHATSAPP",
          recipient: phone,
          providerRef: result.id,
          status: "sent",
        },
        update: {
          providerRef: result.id,
          status: "sent",
          sentAt: new Date(),
        },
      });
    }
  }

  return {
    invitePath,
    inviteUrl,
    emailDelivery: summarizeDeliveries(emailResults),
    whatsappDelivery: summarizeWhatsAppDeliveries(whatsappResults),
    emailResults,
    whatsappResults,
  };
}
