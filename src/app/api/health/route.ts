import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getBlockingProductionEnvIssues } from "@/lib/production-env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  let database: "ok" | "error" = "ok";

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "error";
  }

  const livekitConfigured = Boolean(
    process.env.LIVEKIT_URL &&
      process.env.LIVEKIT_API_KEY &&
      process.env.LIVEKIT_API_SECRET,
  );
  const appUrlConfigured = Boolean(process.env.APP_URL?.trim());
  const envIssueCount =
    process.env.NODE_ENV === "production"
      ? getBlockingProductionEnvIssues().length
      : 0;

  const healthy =
    database === "ok" &&
    livekitConfigured &&
    appUrlConfigured &&
    envIssueCount === 0;

  const body = {
    status: healthy ? "ok" : "degraded",
    service: "genmeet",
    timestamp: new Date().toISOString(),
    uptimeMs: Math.round(process.uptime() * 1000),
    latencyMs: Date.now() - startedAt,
    checks: {
      database,
      livekitConfigured,
      appUrlConfigured,
      envConfigured: envIssueCount === 0,
      paymentProvider: process.env.PAYMENT_PROVIDER || "MIDTRANS",
    },
  };

  return NextResponse.json(body, {
    status: healthy ? 200 : 503,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
