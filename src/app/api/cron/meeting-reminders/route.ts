import { NextResponse } from "next/server";
import { processMeetingReminders } from "@/lib/meeting-reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorizeCron(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return false;
  }

  const header = request.headers.get("authorization");
  if (header === `Bearer ${secret}`) {
    return true;
  }

  const cronHeader = request.headers.get("x-cron-secret");
  return cronHeader === secret;
}

async function run(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const result = await processMeetingReminders();
  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
