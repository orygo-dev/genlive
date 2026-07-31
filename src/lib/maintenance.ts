import "server-only";

import { cache } from "react";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const getMaintenanceMode = cache(async () => {
  try {
    const settings = await prisma.platformSettings.findUnique({
      where: { id: 1 },
      select: { maintenanceMode: true },
    });
    return Boolean(settings?.maintenanceMode);
  } catch {
    return false;
  }
});

/**
 * Blocks non–super-admin traffic when maintenance mode is on.
 * Returns a Response to short-circuit, or null to continue.
 */
export async function maintenanceBlockResponse(options?: {
  isSuperAdmin?: boolean;
  allowDuringMaintenance?: boolean;
}) {
  if (options?.allowDuringMaintenance) return null;
  if (options?.isSuperAdmin) return null;
  if (!(await getMaintenanceMode())) return null;

  return NextResponse.json(
    {
      error:
        "Platform sedang dalam mode maintenance. Silakan coba lagi nanti.",
      maintenance: true,
    },
    { status: 503 },
  );
}
