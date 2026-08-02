import { NextResponse } from "next/server";
import { RoomServiceClient } from "livekit-server-sdk";
import { requireSuperAdminApi } from "@/lib/admin-api";
import { getLiveKitEnvironment } from "@/lib/livekit";
import { getLiveKitApiHost } from "@/lib/livekit-egress";
import { normalizeLivekitUrl } from "@/lib/livekit-url";

export const runtime = "nodejs";

export async function POST() {
  const gate = await requireSuperAdminApi();
  if (gate.error || !gate.context) return gate.error!;

  try {
    const environment = await getLiveKitEnvironment();
    const host = await getLiveKitApiHost();
    const client = new RoomServiceClient(
      host,
      environment.LIVEKIT_API_KEY,
      environment.LIVEKIT_API_SECRET,
    );
    const rooms = await client.listRooms();
    return NextResponse.json({
      ok: true,
      host,
      url: normalizeLivekitUrl(environment.LIVEKIT_URL),
      roomCount: rooms.length,
      message: `LiveKit OK — host ${host} · ${rooms.length} room aktif.`,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal menguji koneksi LiveKit.";
    const hint = message.includes("401") || message.toLowerCase().includes("unauthorized")
      ? " API Key/Secret tidak cocok dengan project Cloud."
      : message.toLowerCase().includes("enotfound") ||
          message.toLowerCase().includes("fetch failed")
        ? " Cek LIVEKIT_URL / LIVEKIT_API_URL dan koneksi internet server."
        : "";
    return NextResponse.json(
      {
        ok: false,
        error: `${message}${hint}`,
      },
      { status: 400 },
    );
  }
}
