import "server-only";

import { AccessToken } from "livekit-server-sdk";
import type { ParticipantRole } from "@/generated/prisma/enums";
import { getLiveKitEnvironment } from "@/lib/livekit";
import {
  classifyLiveKitFailure,
  normalizeLivekitUrl,
} from "@/lib/livekit-url";

type ParticipantTokenInput = {
  identity: string;
  name: string;
  role: ParticipantRole;
  roomName: string;
  serverId?: string | null;
};

function logTokenEvent(
  level: "info" | "warn" | "error",
  message: string,
  data: Record<string, unknown>,
) {
  const payload = {
    scope: "livekit-token",
    ...data,
  };
  if (level === "error") {
    console.error(message, payload);
  } else if (level === "warn") {
    console.warn(message, payload);
  } else {
    console.info(message, payload);
  }
}

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
    if (
      error instanceof Error &&
      (error.message.startsWith("Jam server") ||
        error.message.includes("roomJoin"))
    ) {
      throw error;
    }
    throw new Error("Token LiveKit tidak dapat diverifikasi.");
  }
}

export async function createParticipantToken(input: ParticipantTokenInput) {
  const environment = await getLiveKitEnvironment(input.serverId);
  const serverUrl = normalizeLivekitUrl(environment.LIVEKIT_URL);
  if (!serverUrl) {
    throw new Error("LIVEKIT_URL tidak valid.");
  }

  try {
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

    logTokenEvent("info", "LiveKit participant token minted", {
      serverId: environment.LIVEKIT_SERVER_ID,
      kind: environment.LIVEKIT_KIND,
      // Host only — never log full JWT or API secret.
      serverHost: serverUrl.replace(/^wss?:\/\//, "").split("/")[0],
      apiKeyPrefix: environment.LIVEKIT_API_KEY.slice(0, 6),
      roomName: input.roomName,
      role: input.role,
      identityPrefix: input.identity.slice(0, 12),
      tokenParts: jwt.split(".").length,
    });

    return {
      identity: input.identity,
      role: input.role,
      serverUrl,
      token: jwt,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal membuat token LiveKit.";
    const classified = classifyLiveKitFailure(message, {
      url: serverUrl,
      kind: environment.LIVEKIT_KIND,
    });
    logTokenEvent("error", "LiveKit participant token mint failed", {
      serverId: environment.LIVEKIT_SERVER_ID,
      kind: environment.LIVEKIT_KIND,
      failureKind: classified.kind,
      hint: classified.hint || undefined,
      // Never log API secret or full JWT.
      apiKeyPrefix: environment.LIVEKIT_API_KEY.slice(0, 6),
      roomName: input.roomName,
      error: message,
    });
    throw error;
  }
}
