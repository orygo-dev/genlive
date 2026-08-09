import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import type { ParticipantRole } from "@/generated/prisma/enums";
import { createAdmissionToken } from "@/lib/admission";
import { getCurrentUser } from "@/lib/auth";
import { assertCanConsumeMeetingMinutes } from "@/lib/billing";
import { prisma } from "@/lib/db";
import { createParticipantToken } from "@/lib/livekit-token";
import { getRoomLockState } from "@/lib/livekit-room-admin";
import { maintenanceBlockResponse } from "@/lib/maintenance";
import { meetingRequestSchema } from "@/lib/meeting";
import { isParticipantRoomOpen } from "@/lib/meeting-lifecycle";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
const ADMISSION_TTL_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    const limited = rateLimit(`livekit-token:${ip}`, 60, 60_000);
    if (!limited.ok) {
      return NextResponse.json(
        { error: "Terlalu banyak permintaan token. Coba lagi sebentar." },
        {
          status: 429,
          headers: { "Retry-After": String(limited.retryAfterSec) },
        },
      );
    }

    const body: unknown = await request.json();
    const parsed = meetingRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Data meeting tidak valid." },
        { status: 400 },
      );
    }

    const user = await getCurrentUser();
    const maintenance = await maintenanceBlockResponse({
      isSuperAdmin: Boolean(user?.isSuperAdmin),
    });
    if (maintenance) return maintenance;

    const identity = `${user ? "user" : "guest"}-${crypto.randomUUID()}`;
    const meeting = await prisma.meeting.findUnique({
      where: { roomName: parsed.data.roomName },
      select: {
        id: true,
        organizationId: true,
        createdById: true,
        passwordHash: true,
        waitingRoom: true,
        status: true,
        startsAt: true,
      },
    });

    let role: ParticipantRole = "PARTICIPANT";
    if (meeting && user?.id === meeting.createdById) {
      role = "HOST";
    } else if (meeting && user) {
      const membership = user.memberships.find(
        (item) => item.organization.id === meeting.organizationId,
      );
      if (membership?.role === "OWNER" || membership?.role === "ADMIN") {
        role = "MODERATOR";
      }
    }

    if (meeting && role === "PARTICIPANT") {
      const minutesQuota = await assertCanConsumeMeetingMinutes(
        meeting.organizationId,
      );
      if (!minutesQuota.ok) {
        return NextResponse.json(
          { error: minutesQuota.error },
          { status: minutesQuota.status },
        );
      }
    }

    if (meeting?.status === "CANCELLED" || meeting?.status === "ENDED") {
      return NextResponse.json(
        { error: "Meeting ini sudah tidak menerima peserta." },
        { status: 410 },
      );
    }

    if (
      meeting &&
      role === "PARTICIPANT" &&
      !isParticipantRoomOpen(meeting.status)
    ) {
      return NextResponse.json(
        { error: "Meeting belum dimulai oleh host." },
        { status: 403 },
      );
    }

    if (role === "PARTICIPANT") {
      const locked = await getRoomLockState(parsed.data.roomName);
      if (locked) {
        return NextResponse.json(
          { error: "Meeting sedang dikunci oleh host. Coba lagi nanti." },
          { status: 403 },
        );
      }
    }

    if (meeting?.passwordHash && role === "PARTICIPANT") {
      const passwordMatches =
        parsed.data.password &&
        (await compare(parsed.data.password, meeting.passwordHash));
      if (!passwordMatches) {
        return NextResponse.json(
          { error: "Password meeting tidak sesuai." },
          { status: 401 },
        );
      }
    }

    if (meeting?.waitingRoom && role === "PARTICIPANT") {
      const admission = createAdmissionToken();
      const participant = await prisma.meetingParticipant.create({
        data: {
          meetingId: meeting.id,
          userId: user?.id,
          livekitIdentity: identity,
          displayName: parsed.data.participantName,
          role,
          admissionStatus: "WAITING",
          admissionTokenHash: admission.tokenHash,
          admissionExpiresAt: new Date(Date.now() + ADMISSION_TTL_MS),
        },
        select: { id: true },
      });

      return NextResponse.json(
        {
          waiting: true,
          requestId: participant.id,
          admissionToken: admission.token,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const connection = await createParticipantToken({
      identity,
      name: parsed.data.participantName,
      role,
      roomName: parsed.data.roomName,
    });

    if (meeting) {
      await prisma.$transaction(async (transaction) => {
        if (role !== "PARTICIPANT" && meeting.status === "SCHEDULED") {
          await transaction.meeting.update({
            where: { id: meeting.id },
            data: { status: "ACTIVE" },
          });
        }
        await transaction.meetingParticipant.create({
          data: {
            meetingId: meeting.id,
            userId: user?.id,
            livekitIdentity: identity,
            displayName: parsed.data.participantName,
            role,
            admissionStatus: "ADMITTED",
          },
        });
      });
    }

    return NextResponse.json(
      connection,
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    const raw =
      error instanceof Error ? error.message : "Tidak dapat membuat akses meeting.";
    const isConfigurationError =
      raw.startsWith("Konfigurasi LiveKit") ||
      raw.startsWith("Server LiveKit") ||
      raw.startsWith("LIVEKIT_URL") ||
      raw.startsWith("Token LiveKit") ||
      raw.startsWith("Jam server");
    const message = isConfigurationError
      ? raw
      : "Tidak dapat membuat akses meeting.";
    const status = error instanceof SyntaxError ? 400 : isConfigurationError ? 503 : 500;

    if (!(error instanceof SyntaxError)) {
      console.error("LiveKit token creation failed", {
        scope: "livekit-token-route",
        // Never log secrets or JWT.
        error: raw,
        configurationError: isConfigurationError,
      });
    }

    return NextResponse.json({ error: message }, { status });
  }
}
