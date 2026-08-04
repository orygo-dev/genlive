import "server-only";

import { AccessToken } from "livekit-server-sdk";
import type { ParticipantRole } from "@/generated/prisma/enums";
import { getLiveKitEnvironment } from "@/lib/livekit";

type ParticipantTokenInput = {
  identity: string;
  name: string;
  role: ParticipantRole;
  roomName: string;
  serverId?: string | null;
};

function assertJwtLooksValid(jwt: string, apiKey: string) {
  const parts = jwt.split(".");
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    throw new Error("Token LiveKit rusak (bukan JWT).");
  }

  try {
    const payloadJson = Buffer.from(parts[1], "base64url").toString("utf8");
    const payload = JSON.parse(payloadJson) as {
      iss?: string;
      video?: { room?: string; roomJoin?: boolean };
      exp?: number;
      nbf?: number;
    };

    if (payload.iss && payload.iss !== apiKey) {
      throw new Error(
        "Token LiveKit tidak cocok dengan API Key. Simpan ulang URL + Key + Secret dari project Cloud yang sama.",
      );
    }

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.nbf === "number" && payload.nbf > now + 120) {
      throw new Error(
        "Jam server terlalu berbeda (token belum valid). Sinkronkan waktu NTP di server.",
      );
    }
    if (typeof payload.exp === "number" && payload.exp <= now) {
      throw new Error("Token LiveKit sudah kedaluwarsa saat dibuat.");
    }
    if (!payload.video?.roomJoin) {
      throw new Error("Token LiveKit tidak punya izin roomJoin.");
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Token LiveKit")) {
      throw error;
    }
    throw new Error("Token LiveKit tidak dapat diverifikasi.");
  }
}

export async function createParticipantToken(input: ParticipantTokenInput) {
  const environment = await getLiveKitEnvironment(input.serverId);
  const token = new AccessToken(
    environment.LIVEKIT_API_KEY,
    environment.LIVEKIT_API_SECRET,
    {
      identity: input.identity,
      name: input.name,
      ttl: "6h",
    },
  );

  token.addGrant({
    room: input.roomName,
    roomJoin: true,
    roomAdmin: input.role === "HOST" || input.role === "MODERATOR",
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    canUpdateOwnMetadata: true,
  });

  const jwt = await token.toJwt();
  assertJwtLooksValid(jwt, environment.LIVEKIT_API_KEY);

  return {
    identity: input.identity,
    role: input.role,
    serverUrl: environment.LIVEKIT_URL,
    token: jwt,
  };
}
