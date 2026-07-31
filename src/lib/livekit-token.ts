import "server-only";

import { AccessToken } from "livekit-server-sdk";
import type { ParticipantRole } from "@/generated/prisma/enums";
import { getLiveKitEnvironment } from "@/lib/livekit";

type ParticipantTokenInput = {
  identity: string;
  name: string;
  role: ParticipantRole;
  roomName: string;
};

export async function createParticipantToken(input: ParticipantTokenInput) {
  const environment = await getLiveKitEnvironment();
  const token = new AccessToken(
    environment.LIVEKIT_API_KEY,
    environment.LIVEKIT_API_SECRET,
    {
      identity: input.identity,
      name: input.name,
      ttl: "2h",
    },
  );

  token.addGrant({
    room: input.roomName,
    roomJoin: true,
    roomAdmin: input.role === "HOST" || input.role === "MODERATOR",
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  return {
    identity: input.identity,
    role: input.role,
    serverUrl: environment.LIVEKIT_URL,
    token: await token.toJwt(),
  };
}
