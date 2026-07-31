import { NextResponse } from "next/server";
import { processPlanReminders } from "@/lib/plan-reminders";
import { getPlatformConfig } from "@/lib/platform-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authorizeCron(request: Request) {
  const config = await getPlatformConfig();
  const secret = config.cronSecret;
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
  if (!(await authorizeCron(request))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const result = await processPlanReminders();
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
