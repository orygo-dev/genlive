import { NextResponse } from "next/server";
import { RoomServiceClient } from "livekit-server-sdk";
import { requireSuperAdminApi } from "@/lib/admin-api";
import { getLiveKitEnvironment, getLiveKitServerProfiles } from "@/lib/livekit";
import { getLiveKitApiHost } from "@/lib/livekit-egress";
import {
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

function connectionHint(message: string, kind?: string, url?: string | null) {
  const lower = message.toLowerCase();
  const isCloud =
    kind === "CLOUD" || Boolean(url?.includes(".livekit.cloud"));
  if (lower.includes("401") || lower.includes("unauthorized")) {
    return isCloud
      ? " API Key/Secret tidak cocok dengan project Cloud yang sama dengan URL."
      : " API Key/Secret tidak cocok dengan server self-hosted (cek keys.yaml / LIVEKIT_KEYS).";
  }
  if (lower.includes("enotfound") || lower.includes("fetch failed")) {
    return isCloud
      ? " Cek LIVEKIT_URL / LIVEKIT_API_URL dan koneksi internet server GenMeet."
      : " Cek LIVEKIT_API_URL self-hosted dapat dijangkau dari server GenMeet (firewall/DNS/TLS).";
  }
  if (
    lower.includes("certificate") ||
    lower.includes("ssl") ||
    lower.includes("tls")
  ) {
    return " Sertifikat TLS API LiveKit bermasalah — pastikan HTTPS valid atau gunakan http:// untuk lab internal.";
  }
  return "";
}

export async function POST(request: Request) {
  const gate = await requireSuperAdminApi();
  if (gate.error || !gate.context) return gate.error!;

  const payload = (await request.json().catch(() => ({}))) as TestPayload;

  try {
    const draftUrl = normalizeLivekitUrl(payload.url);
    const draftKey = sanitizeLivekitCredential(payload.apiKey);
    const draftSecret = sanitizeLivekitCredential(payload.apiSecret);

    // Prefer draft form values so Tes koneksi works before Simpan & terapkan.
    // Missing secrets fall back to the saved profile for the same serverId.
    let host: string;
    let url: string | null;
    let apiKey: string;
    let apiSecret: string;
    let serverId: string | undefined = payload.serverId;
    let kind = payload.kind;

    if (draftUrl && (draftKey || draftSecret || payload.serverId)) {
      const profiles = payload.serverId
        ? await getLiveKitServerProfiles()
        : [];
      const saved = profiles.find((profile) => profile.id === payload.serverId);
      apiKey = draftKey || saved?.apiKey || "";
      apiSecret = draftSecret || saved?.apiSecret || "";
      url = draftUrl;
      host =
        normalizeLivekitApiUrl(payload.apiUrl, draftUrl)?.replace(/\/$/, "") ||
        "";
      kind = kind || saved?.kind;
      serverId = payload.serverId || saved?.id;
      if (!apiKey || !apiSecret || !host) {
        throw new Error(
          "Isi LIVEKIT_URL, API Key, dan API Secret terlebih dahulu (atau simpan profil lalu uji ulang).",
        );
      }
    } else {
      const environment = await getLiveKitEnvironment(payload.serverId);
      host = await getLiveKitApiHost(payload.serverId);
      url = normalizeLivekitUrl(environment.LIVEKIT_URL);
      apiKey = environment.LIVEKIT_API_KEY;
      apiSecret = environment.LIVEKIT_API_SECRET;
      serverId = environment.LIVEKIT_SERVER_ID;
      kind = environment.LIVEKIT_URL.includes(".livekit.cloud")
        ? "CLOUD"
        : "SELF_HOSTED";
    }

    const client = new RoomServiceClient(host, apiKey, apiSecret);
    const rooms = await client.listRooms();
    return NextResponse.json({
      ok: true,
      host,
      url,
      roomCount: rooms.length,
      serverId,
      kind,
      message: `LiveKit OK (${kind === "CLOUD" ? "Cloud" : "Self-hosted"}) — host ${host} · ${rooms.length} room aktif.`,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal menguji koneksi LiveKit.";
    const hint = connectionHint(message, payload.kind, payload.url);
    return NextResponse.json(
      {
        ok: false,
        error: `${message}${hint}`,
      },
      { status: 400 },
    );
  }
}
