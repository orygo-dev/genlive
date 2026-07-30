import { NextResponse } from "next/server";
import { deleteCurrentSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  try {
    await deleteCurrentSession();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Logout failed", error);
    return NextResponse.json(
      { error: "Logout belum dapat diproses." },
      { status: 500 },
    );
  }
}
