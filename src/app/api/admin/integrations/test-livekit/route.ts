import { NextResponse } from "next/server";
import { RoomServiceClient } from "livekit-server-sdk";
import { requireSuperAdminApi } from "@/lib/admin-api";
import { getLiveKitEnvironment } from "@/lib/livekit";
import { getLiveKitApiHost } from "@/lib/livekit-egress";

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
      roomCount: rooms.length,
      message: `LiveKit OK — ${rooms.length} room terdeteksi.`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Gagal menguji koneksi LiveKit.",
      },
      { status: 400 },
    );
  }
}
