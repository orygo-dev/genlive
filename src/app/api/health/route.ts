import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getPlatformConfig } from "@/lib/platform-config";
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

  let config;
  try {
    config = await getPlatformConfig();
  } catch {
    config = null;
  }

  const livekitConfigured = Boolean(
    config?.livekitUrl && config.livekitApiKey && config.livekitApiSecret,
  );
  const appUrlConfigured = Boolean(config?.appUrl?.trim());
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
    buildId: "cam-toggle-2026-08-09g-debug",
    timestamp: new Date().toISOString(),
    uptimeMs: Math.round(process.uptime() * 1000),
    latencyMs: Date.now() - startedAt,
    checks: {
      database,
      livekitConfigured,
      appUrlConfigured,
      envConfigured: envIssueCount === 0,
      paymentProvider: config?.paymentProvider || "MIDTRANS",
    },
  };

  return NextResponse.json(body, {
    status: healthy ? 200 : 503,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
