import { NextResponse } from "next/server";
import { getRoomBreakoutState } from "@/lib/livekit-room-admin";

export const runtime = "nodejs";

type BreakoutStatusProps = {
  params: Promise<{ roomName: string }>;
};

export async function GET(_: Request, { params }: BreakoutStatusProps) {
  const { roomName } = await params;
  const mainRoomName = roomName.replace(/-bo-\d+$/, "") || roomName;
  const breakout = await getRoomBreakoutState(mainRoomName);
  return NextResponse.json(
    {
      mainRoomName,
      active: breakout.active,
      endsAt: breakout.endsAt ?? null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
