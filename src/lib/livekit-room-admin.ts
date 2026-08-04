import "server-only";

import { RoomServiceClient, TrackType } from "livekit-server-sdk";
import { getLiveKitEnvironment } from "@/lib/livekit";
import { getLiveKitApiHost } from "@/lib/livekit-egress";
import {
  parseRoomMetadata,
  serializeRoomMetadata,
  type RoomLockMetadata,
} from "@/lib/livekit-room-metadata";

export type { RoomLockMetadata };
export { parseRoomMetadata, serializeRoomMetadata };

export async function getRoomServiceClient(serverId?: string | null) {
  const environment = await getLiveKitEnvironment(serverId);
  return new RoomServiceClient(
    await getLiveKitApiHost(serverId),
    environment.LIVEKIT_API_KEY,
    environment.LIVEKIT_API_SECRET,
  );
}

export async function getRoomLockState(roomName: string): Promise<boolean> {
  const client = await getRoomServiceClient();
  try {
    const rooms = await client.listRooms([roomName]);
    const room = rooms[0];
    return parseRoomMetadata(room?.metadata).locked === true;
  } catch {
    return false;
  }
}

export async function setRoomLocked(roomName: string, locked: boolean) {
  const client = await getRoomServiceClient();
  const rooms = await client.listRooms([roomName]);
  const current = rooms[0]?.metadata ?? "";
  const metadata = serializeRoomMetadata(current, { locked });
  await client.updateRoomMetadata(roomName, metadata);
  return { locked };
}

export async function muteParticipantTracks(input: {
  roomName: string;
  identity: string;
  trackKind?: "audio" | "video" | "all";
  muted?: boolean;
}) {
  const client = await getRoomServiceClient();
  const muted = input.muted ?? true;
  const kind = input.trackKind ?? "audio";
  const participant = await client.getParticipant(input.roomName, input.identity);
  const tracks = participant.tracks ?? [];

  let mutedCount = 0;
  for (const track of tracks) {
    const isAudio = track.type === TrackType.AUDIO;
    const isVideo = track.type === TrackType.VIDEO;
    if (kind === "audio" && !isAudio) continue;
    if (kind === "video" && !isVideo) continue;
    if (!track.sid) continue;
    await client.mutePublishedTrack(
      input.roomName,
      input.identity,
      track.sid,
      muted,
    );
    mutedCount += 1;
  }
  return { mutedCount };
}

export async function muteAllRemoteAudio(input: {
  roomName: string;
  exceptIdentity?: string;
}) {
  const client = await getRoomServiceClient();
  const participants = await client.listParticipants(input.roomName);
  let mutedCount = 0;
  for (const participant of participants) {
    if (!participant.identity) continue;
    if (
      input.exceptIdentity &&
      participant.identity === input.exceptIdentity
    ) {
      continue;
    }
    const result = await muteParticipantTracks({
      roomName: input.roomName,
      identity: participant.identity,
      trackKind: "audio",
      muted: true,
    });
    mutedCount += result.mutedCount;
  }
  return { mutedCount, participantCount: participants.length };
}

export async function setRoomBreakoutState(
  roomName: string,
  breakout: { active: boolean; endsAt?: number },
) {
  const client = await getRoomServiceClient();
  const rooms = await client.listRooms([roomName]);
  const current = rooms[0]?.metadata ?? "";
  const metadata = serializeRoomMetadata(current, { breakout });
  await client.updateRoomMetadata(roomName, metadata);
  return { breakout };
}

export async function getRoomBreakoutState(roomName: string) {
  const client = await getRoomServiceClient();
  try {
    const rooms = await client.listRooms([roomName]);
    return parseRoomMetadata(rooms[0]?.metadata).breakout ?? {
      active: false,
    };
  } catch {
    return { active: false };
  }
}

export async function kickParticipant(roomName: string, identity: string) {
  const client = await getRoomServiceClient();
  await client.removeParticipant(roomName, identity);
}
