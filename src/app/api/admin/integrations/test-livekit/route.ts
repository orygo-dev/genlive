import { NextResponse } from "next/server";
import {
  AccessToken,
  RoomServiceClient,
  TokenVerifier,
} from "livekit-server-sdk";
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

function safeCredentialMeta(
  apiKey: string,
  apiSecret: string,
  kind: "CLOUD" | "SELF_HOSTED",
) {
  // LiveKit Cloud secrets are typically 43–44 chars. Length 32 often means a
  // truncated paste: local JWT round-trip still passes (same short secret signs
  // and verifies), but Cloud rejects with "invalid token".
  const cloudSecretTooShort = kind === "CLOUD" && apiSecret.length < 40;
  return {
    apiKeyLength: apiKey.length,
    apiKeyPrefix: apiKey.slice(0, 8),
    apiKeyLooksLikeLivekit: apiKey.startsWith("API"),
    apiSecretLength: apiSecret.length,
    apiSecretLooksTruncated:
      apiSecret.length > 0 &&
      (apiSecret.length < 32 || cloudSecretTooShort),
    cloudSecretTooShort,
  };
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
    let credentialSource: "draft" | "saved" | "environment" = "draft";

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

      const savedUrl = saved ? normalizeLivekitUrl(saved.url) : null;
      const urlChanged = Boolean(savedUrl && draftUrl !== savedUrl);
      if (urlChanged && (!draftKey || !draftSecret)) {
        throw new Error(
          "URL LiveKit berubah. Isi ulang API Key dan API Secret dari project/server yang sama dengan URL baru (jangan andalkan nilai tersimpan), lalu Tes koneksi.",
        );
      }

      if (draftKey && draftSecret) {
        apiKey = draftKey;
        apiSecret = draftSecret;
        credentialSource = "draft";
      } else {
        apiKey = saved?.apiKey || "";
        apiSecret = saved?.apiSecret || "";
        credentialSource = "saved";
      }

      url = draftUrl;
      kind =
        payload.kind ||
        saved?.kind ||
        (isLivekitCloudUrl(draftUrl) ? "CLOUD" : "SELF_HOSTED");

      host =
        (kind === "CLOUD"
          ? deriveLivekitApiUrl(draftUrl)
          : normalizeLivekitApiUrl(payload.apiUrl, draftUrl, {
              kind: "SELF_HOSTED",
            }))?.replace(/\/$/, "") || "";

      serverId = payload.serverId || saved?.id;
      if (!apiKey || !apiSecret || !host) {
        throw new Error(
          "Isi LIVEKIT_URL, API Key, dan API Secret di form (tempel ulang keduanya), lalu Tes koneksi. Jangan hanya mengandalkan placeholder “(tersimpan)” jika Key baru dibuat di Cloud.",
        );
      }

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
      url =
        normalizeLivekitUrl(environment.LIVEKIT_URL) || environment.LIVEKIT_URL;
      apiKey = environment.LIVEKIT_API_KEY;
      apiSecret = environment.LIVEKIT_API_SECRET;
      serverId = environment.LIVEKIT_SERVER_ID;
      kind = environment.LIVEKIT_KIND;
      credentialSource = "environment";
    }

    const meta = safeCredentialMeta(apiKey, apiSecret, kind);
    if (meta.cloudSecretTooShort) {
      throw new Error(
        `API Secret Cloud terlihat terpotong (panjang ${meta.apiSecretLength}, biasanya 43–44). Buat key baru di LiveKit Cloud → Settings → Keys, salin Secret dengan tombol Copy, tempel di Notepad dulu untuk cek panjangnya, lalu isi form GenMeet.`,
      );
    }
    if (meta.apiSecretLooksTruncated) {
      throw new Error(
        `API Secret terlihat terpotong (panjang ${meta.apiSecretLength}). Salin ulang Secret dengan tombol Copy (bukan seleksi manual).`,
      );
    }

    // Local round-trip: proves Key+Secret can sign & verify together (no network).
    const probe = new AccessToken(apiKey, apiSecret, {
      identity: `genmeet-probe-${Date.now()}`,
      ttl: "2m",
    });
    probe.addGrant({
      room: `genmeet-probe-${Date.now()}`,
      roomJoin: true,
      roomList: true,
      canPublish: false,
      canSubscribe: false,
    });
    const jwt = await probe.toJwt();
    const parts = jwt.split(".");
    if (parts.length !== 3) {
      throw new Error("Token LiveKit rusak (bukan JWT).");
    }
    try {
      await new TokenVerifier(apiKey, apiSecret).verify(jwt);
    } catch {
      throw new Error(
        "API Key dan API Secret tidak saling cocok (verifikasi lokal gagal). Salin ulang pasangan Key+Secret dari baris yang sama di LiveKit Cloud Keys.",
      );
    }

    // Remote admin API — Cloud rejects here if Key belongs to a different project than host.
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
      logTestEvent("error", "LiveKit listRooms rejected credentials", {
        ...meta,
        host,
        urlHost: url.replace(/^wss?:\/\//, "").split("/")[0],
        credentialSource,
        kind,
        serverId,
        failureKind: classified.kind,
        error: raw,
        // Confirm we are NOT silently using process.env when draft/saved provided.
        envKeyPresent: Boolean(process.env.LIVEKIT_API_KEY?.trim()),
        envKeySamePrefix:
          process.env.LIVEKIT_API_KEY?.trim()?.slice(0, 8) === meta.apiKeyPrefix,
      });
      if (classified.kind === "unauthorized") {
        throw new Error(
          [
            `LiveKit Cloud menolak Key/Secret untuk host ${host} (${raw}).`,
            "Verifikasi lokal Key+Secret SUDAH cocok — jadi masalahnya pasangan project:",
            `1) Buka project yang URL-nya persis ${url}`,
            "2) Settings → Keys → Create key baru → Copy Key dan Secret",
            "3) Tempel keduanya di form GenMeet (jangan pakai key project lain / webhook secret)",
            "4) Simpan & terapkan, lalu Tes lagi",
            `(diagnostik aman: key ${meta.apiKeyPrefix}… len=${meta.apiKeyLength}, secretLen=${meta.apiSecretLength}, sumber=${credentialSource})`,
          ].join(" "),
        );
      }
      throw listError instanceof Error ? listError : new Error(raw);
    }

    logTestEvent("info", "LiveKit connection test OK", {
      ...meta,
      serverId,
      kind,
      host,
      credentialSource,
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
      credentialSource,
      diagnostics: meta,
      checks: {
        urlValid: true,
        localTokenRoundTrip: true,
        apiReachable: true,
        credentialsAccepted: true,
      },
      message: `LiveKit OK (${kind === "CLOUD" ? "Cloud" : "Self-hosted"}) — ${host} · ${rooms.length} room · sumber kredensial: ${credentialSource}.`,
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
