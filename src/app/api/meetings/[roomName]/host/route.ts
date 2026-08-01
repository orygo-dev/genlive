import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSessionContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManageMeeting } from "@/lib/meeting-access";
import {
  getRoomLockState,
  kickParticipant,
  muteAllRemoteAudio,
  muteParticipantTracks,
  setRoomBreakoutState,
  setRoomLocked,
} from "@/lib/livekit-room-admin";
import { writeAuditLog } from "@/lib/organization";

export const runtime = "nodejs";

type HostRouteProps = {
  params: Promise<{ roomName: string }>;
};

const hostActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("mute"),
    identity: z.string().min(1),
    trackKind: z.enum(["audio", "video", "all"]).optional(),
    muted: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("mute_all"),
    exceptIdentity: z.string().min(1).optional(),
  }),
  z.object({
    action: z.literal("kick"),
    identity: z.string().min(1),
  }),
  z.object({
    action: z.literal("lock"),
    locked: z.boolean(),
  }),
  z.object({
    action: z.literal("breakout"),
    active: z.boolean(),
    endsAt: z.number().optional(),
  }),
]);

async function loadManagedMeeting(roomName: string) {
  return prisma.meeting.findUnique({
    where: { roomName },
    select: {
      id: true,
      organizationId: true,
      createdById: true,
      roomName: true,
      title: true,
      status: true,
    },
  });
}

export async function GET(_: Request, { params }: HostRouteProps) {
  const { roomName } = await params;
  const context = await getCurrentSessionContext();
  if (!context) {
    return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  }

  const meeting = await loadManagedMeeting(roomName);
  if (!meeting) {
    return NextResponse.json({ error: "Meeting tidak ditemukan." }, { status: 404 });
  }
  if (!canManageMeeting(context.user, meeting)) {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  const locked = await getRoomLockState(roomName);
  return NextResponse.json(
    { locked, canManage: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request, { params }: HostRouteProps) {
  try {
    const { roomName } = await params;
    const context = await getCurrentSessionContext();
    if (!context) {
      return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
    }

    const meeting = await loadManagedMeeting(roomName);
    if (!meeting) {
      return NextResponse.json({ error: "Meeting tidak ditemukan." }, { status: 404 });
    }
    if (!canManageMeeting(context.user, meeting)) {
      return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
    }

    const body: unknown = await request.json();
    const parsed = hostActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Aksi tidak valid." },
        { status: 400 },
      );
    }

    const action = parsed.data;

    if (action.action === "mute") {
      const result = await muteParticipantTracks({
        roomName,
        identity: action.identity,
        trackKind: action.trackKind,
        muted: action.muted,
      });
      await writeAuditLog({
        organizationId: meeting.organizationId,
        actorId: context.user.id,
        action: "meeting.host_mute",
        targetType: "meeting",
        targetId: meeting.id,
        metadata: {
          identity: action.identity,
          trackKind: action.trackKind ?? "audio",
          muted: action.muted ?? true,
        },
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (action.action === "mute_all") {
      const result = await muteAllRemoteAudio({
        roomName,
        exceptIdentity: action.exceptIdentity,
      });
      await writeAuditLog({
        organizationId: meeting.organizationId,
        actorId: context.user.id,
        action: "meeting.host_mute_all",
        targetType: "meeting",
        targetId: meeting.id,
        metadata: result,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (action.action === "kick") {
      await kickParticipant(roomName, action.identity);
      await writeAuditLog({
        organizationId: meeting.organizationId,
        actorId: context.user.id,
        action: "meeting.host_kick",
        targetType: "meeting",
        targetId: meeting.id,
        metadata: { identity: action.identity },
      });
      return NextResponse.json({ ok: true });
    }

    if (action.action === "breakout") {
      const result = await setRoomBreakoutState(roomName, {
        active: action.active,
        endsAt: action.endsAt,
      });
      await writeAuditLog({
        organizationId: meeting.organizationId,
        actorId: context.user.id,
        action: action.active ? "meeting.breakout_start" : "meeting.breakout_end",
        targetType: "meeting",
        targetId: meeting.id,
        metadata: result,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    const lockResult = await setRoomLocked(roomName, action.locked);
    await writeAuditLog({
      organizationId: meeting.organizationId,
      actorId: context.user.id,
      action: action.locked ? "meeting.lock" : "meeting.unlock",
      targetType: "meeting",
      targetId: meeting.id,
      metadata: lockResult,
    });
    return NextResponse.json({ ok: true, ...lockResult });
  } catch (error) {
    console.error("Host meeting action failed", error);
    return NextResponse.json(
      { error: "Aksi host belum dapat diproses." },
      { status: 500 },
    );
  }
}
