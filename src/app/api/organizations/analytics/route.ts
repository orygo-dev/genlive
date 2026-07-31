import { NextResponse } from "next/server";
import { getCurrentSessionContext } from "@/lib/auth";
import { getOrganizationAnalytics } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const context = await getCurrentSessionContext();
  if (!context?.activeMembership) {
    return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  }

  const organizationId = context.activeMembership.organization.id;
  const analytics = await getOrganizationAnalytics(organizationId);

  return NextResponse.json(analytics, {
    headers: { "Cache-Control": "no-store" },
  });
}
