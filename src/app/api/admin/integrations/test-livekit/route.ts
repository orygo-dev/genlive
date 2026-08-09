import { NextResponse } from "next/server";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { requireSuperAdminApi } from "@/lib/admin-api";
import { getLiveKitEnvironment, getLiveKitServerProfiles } from "@/lib/livekit";
import { normalizeLiveKitServerProfile } from "@/lib/livekit-config";
import { getLiveKitApiHost } from "@/lib/livekit-egress";
import {
  classifyLiveKitFailure,
  deriveLivekitApiUrl,
  isLivekitCloudUrl,
  isValidLivekitUrl,
  normalizeLivekitApiUrl,
  normalizeLivekitUrl,
  sanitizeLivekitCredential,
} from "@/lib/livekit-url";

export const runtime = "nodejs";

type TestPayload = {
  serverId?: string;
  url?: string;
  apiUrl?: string;
  apiKey?: string;
  apiSecret?: string;
  kind?: "CLOUD" | "SELF_HOSTED";
};

function logTestEvent(
  level: "info" | "warn" | "error",
  message: string,
  data: Record<string, unknown>,
) {
  const payload = { scope: "livekit-test", ...data };
  if (level === "error") console.error(message, payload);
  else if (level === "warn") console.warn(message, payload);
  else console.info(message, payload);
}

export async function POST(request: Request) {
  const gate = await requireSuperAdminApi();
  if (gate.error || !gate.context) return gate.error!;

  const payload = (await request.json().catch(() => ({}))) as TestPayload;

  try {
    const draftUrl = normalizeLivekitUrl(payload.url);
    const draftKey = sanitizeLivekitCredential(payload.apiKey);
    const draftSecret = sanitizeLivekitCredential(payload.apiSecret);
    const draftKind =
      payload.kind ||
      (isLivekitCloudUrl(draftUrl) ? "CLOUD" : "SELF_HOSTED");

    let host: string;
    let url: string;
    let apiKey: string;
    let apiSecret: string;
    let serverId: string | undefined = payload.serverId;
    let kind: "CLOUD" | "SELF_HOSTED" = draftKind;

    if (draftUrl && (draftKey || draftSecret || payload.serverId)) {
      if (!isValidLivekitUrl(draftUrl)) {
        throw new Error(
          "LIVEKIT_URL tidak valid. Gunakan wss://…livekit.cloud (Cloud) atau wss://domain (self-hosted).",
        );
      }

      const profiles = payload.serverId
        ? await getLiveKitServerProfiles()
        : [];
      const saved = profiles.find((profile) => profile.id === payload.serverId);

      // If URL changed vs saved profile, require fresh key+secret to avoid
      // silently testing Cloud URL with leftover self-hosted credentials.
      const savedUrl = saved ? normalizeLivekitUrl(saved.url) : null;
      const urlChanged = Boolean(savedUrl && draftUrl !== savedUrl);
      if (urlChanged && (!draftKey || !draftSecret)) {
        throw new Error(
          "URL LiveKit berubah. Isi ulang API Key dan API Secret dari project/server yang sama dengan URL baru, lalu Tes koneksi.",
        );
      }

      apiKey = draftKey || saved?.apiKey || "";
      apiSecret = draftSecret || saved?.apiSecret || "";
      url = draftUrl;
      kind =
        payload.kind ||
        saved?.kind ||
        (isLivekitCloudUrl(draftUrl) ? "CLOUD" : "SELF_HOSTED");

      // Cloud: always derive API host from LIVEKIT_URL (no separate API URL).
      host =
        (kind === "CLOUD"
          ? deriveLivekitApiUrl(draftUrl)
          : normalizeLivekitApiUrl(payload.apiUrl, draftUrl, {
              kind: "SELF_HOSTED",
            }))?.replace(/\/$/, "") || "";

      serverId = payload.serverId || saved?.id;
      if (!apiKey || !apiSecret || !host) {
        throw new Error(
          "Isi LIVEKIT_URL, API Key, dan API Secret terlebih dahulu (atau simpan profil lalu uji ulang).",
        );
      }

      // Validate the trio can form a coherent profile.
      if (
        !normalizeLiveKitServerProfile({
          id: serverId || "draft",
          name: "draft",
          kind,
          url,
          apiUrl: host,
          apiKey,
          apiSecret,
        })
      ) {
        throw new Error("Kombinasi URL + API Key + API Secret tidak valid.");
      }
    } else {
      const environment = await getLiveKitEnvironment(payload.serverId);
      host = (await getLiveKitApiHost(payload.serverId)).replace(/\/$/, "");
      url = normalizeLivekitUrl(environment.LIVEKIT_URL) || environment.LIVEKIT_URL;
      apiKey = environment.LIVEKIT_API_KEY;
      apiSecret = environment.LIVEKIT_API_SECRET;
      serverId = environment.LIVEKIT_SERVER_ID;
      kind = environment.LIVEKIT_KIND;
    }

    // 1) Admin API: listRooms proves key/secret accepted by this host.
    let rooms;
    try {
      const client = new RoomServiceClient(host, apiKey, apiSecret);
      rooms = await client.listRooms();
    } catch (listError) {
      const raw =
        listError instanceof Error
          ? listError.message
          : "Gagal memanggil LiveKit listRooms.";
      const classified = classifyLiveKitFailure(raw, { url, kind });
      // Surface a clear Cloud-focused message for the common "invalid token" reply.
      if (classified.kind === "unauthorized") {
        throw new Error(
          `LiveKit menolak API Key/Secret (${raw}). Pastikan Key + Secret dari project Cloud yang sama dengan ${url}.`,
        );
      }
      throw listError instanceof Error
        ? listError
        : new Error(raw);
    }

    // 2) Mint a short-lived join token (same path as meeting join) and check iss.
    const probe = new AccessToken(apiKey, apiSecret, {
      identity: `genmeet-probe-${Date.now()}`,
      ttl: "2m",
    });
    probe.addGrant({
      room: `genmeet-probe-${Date.now()}`,
      roomJoin: true,
      canPublish: false,
      canSubscribe: false,
    });
    const jwt = await probe.toJwt();
    const parts = jwt.split(".");
    if (parts.length !== 3) {
      throw new Error("Token LiveKit rusak (bukan JWT).");
    }
    const claims = JSON.parse(
      Buffer.from(parts[1]!, "base64url").toString("utf8"),
    ) as { iss?: string };
    if (claims.iss && claims.iss !== apiKey) {
      throw new Error(
        "Token LiveKit tidak cocok dengan API Key (iss mismatch).",
      );
    }

    logTestEvent("info", "LiveKit connection test OK", {
      serverId,
      kind,
      host,
      urlHost: url.replace(/^wss?:\/\//, "").split("/")[0],
      apiKeyPrefix: apiKey.slice(0, 6),
      roomCount: rooms.length,
      tokenParts: parts.length,
    });

    return NextResponse.json({
      ok: true,
      host,
      url,
      roomCount: rooms.length,
      serverId,
      kind,
      checks: {
        urlValid: true,
        apiReachable: true,
        credentialsAccepted: true,
        tokenMinted: true,
      },
      message: `LiveKit OK (${kind === "CLOUD" ? "Cloud" : "Self-hosted"}) — ${host} · ${rooms.length} room · token mint OK.`,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal menguji koneksi LiveKit.";
    const classified = classifyLiveKitFailure(message, {
      kind: payload.kind,
      url: payload.url,
    });
    logTestEvent("error", "LiveKit connection test failed", {
      serverId: payload.serverId,
      kind: payload.kind,
      failureKind: classified.kind,
      hint: classified.hint || undefined,
      error: message,
    });
    return NextResponse.json(
      {
        ok: false,
        failureKind: classified.kind,
        error: classified.hint ? `${message} ${classified.hint}` : message,
      },
      { status: 400 },
    );
  }
}
