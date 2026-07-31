import { NextResponse } from "next/server";
import { getCurrentSessionContext } from "@/lib/auth";
import {
  analyticsToCsv,
  getOrganizationAnalytics,
} from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const context = await getCurrentSessionContext();
  if (!context?.activeMembership) {
    return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  }

  const organizationId = context.activeMembership.organization.id;
  const orgName = context.activeMembership.organization.name;
  const analytics = await getOrganizationAnalytics(organizationId);
  const csv = analyticsToCsv(analytics);
  const safeName = orgName.replace(/[^\w\-]+/g, "_").slice(0, 40);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="analytics-${safeName}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
