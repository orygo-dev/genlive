import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSessionContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseInviteEmails } from "@/lib/email-templates";
import { deliverMeetingInvites } from "@/lib/meeting-invites";
import { canManageMeeting } from "@/lib/meeting-access";
import { writeAuditLog } from "@/lib/organization";
import { isValidInvitePhone, parseInvitePhones } from "@/lib/phone";

export const runtime = "nodejs";

type InviteRouteProps = {
  params: Promise<{ id: string }>;
};

const inviteSchema = z.object({
  emails: z.union([z.string(), z.array(z.string())]).optional(),
  phones: z.union([z.string(), z.array(z.string())]).optional(),
});

export async function POST(request: Request, { params }: InviteRouteProps) {
  try {
    const { id } = await params;
    const context = await getCurrentSessionContext();
    if (!context) {
      return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
    }

    const meeting = await prisma.meeting.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        roomName: true,
        status: true,
        startsAt: true,
        waitingRoom: true,
        passwordHash: true,
        organizationId: true,
        createdById: true,
        organization: { select: { name: true } },
      },
    });

    if (!meeting) {
      return NextResponse.json({ error: "Meeting tidak ditemukan." }, { status: 404 });
    }

    if (!canManageMeeting(context.user, meeting)) {
      return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
    }

    if (meeting.status === "ENDED" || meeting.status === "CANCELLED") {
      return NextResponse.json(
        { error: "Meeting yang sudah selesai atau dibatalkan tidak dapat diundang." },
        { status: 409 },
      );
    }

    const payload: unknown = await request.json();
    const result = inviteSchema.safeParse(payload);
    if (!result.success) {
      return NextResponse.json({ error: "Data undangan tidak valid." }, { status: 400 });
    }

    const emails = parseInviteEmails(result.data.emails);
    const phones = parseInvitePhones(result.data.phones);

    if (emails.length === 0 && phones.length === 0) {
      return NextResponse.json(
        { error: "Masukkan minimal satu email atau nomor WhatsApp." },
        { status: 400 },
      );
    }

    const invalidEmail = emails.find(
      (email) => !z.string().email().safeParse(email).success,
    );
    if (invalidEmail) {
      return NextResponse.json(
        { error: `Email undangan tidak valid: ${invalidEmail}` },
        { status: 400 },
      );
    }

    const invalidPhone = phones.find((phone) => !isValidInvitePhone(phone));
    if (invalidPhone) {
      return NextResponse.json(
        { error: `Nomor WhatsApp tidak valid: ${invalidPhone}` },
        { status: 400 },
      );
    }

    const delivery = await deliverMeetingInvites({
      meeting,
      hostName: context.user.name,
      emails,
      phones,
      requestOrigin: new URL(request.url).origin,
    });

    await writeAuditLog({
      organizationId: meeting.organizationId,
      actorId: context.user.id,
      action: "meeting.invited",
      targetType: "meeting",
      targetId: meeting.id,
      metadata: {
        emails,
        phones,
        emailDelivery: delivery.emailDelivery,
        whatsappDelivery: delivery.whatsappDelivery,
        roomName: meeting.roomName,
      },
    });

    return NextResponse.json({
      inviteUrl: delivery.invitePath,
      delivery: delivery.emailDelivery,
      whatsappDelivery: delivery.whatsappDelivery,
      invitedCount: emails.length + phones.length,
      results: {
        email: delivery.emailResults.map((item, index) => ({
          email: emails[index],
          delivery: item.delivery,
        })),
        whatsapp: delivery.whatsappResults.map((item, index) => ({
          phone: phones[index],
          delivery: item.delivery,
        })),
      },
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Format data tidak valid." }, { status: 400 });
    }

    console.error("Meeting invite failed", error);
    return NextResponse.json(
      { error: "Undangan meeting belum dapat dikirim." },
      { status: 500 },
    );
  }
}
