import "server-only";

import { redirect } from "next/navigation";
import { getCurrentSessionContext } from "@/lib/auth";
import { getMaintenanceMode } from "@/lib/maintenance";

type SessionContext = NonNullable<
  Awaited<ReturnType<typeof getCurrentSessionContext>>
>;

export type ActiveDashboardContext = SessionContext & {
  activeMembership: NonNullable<SessionContext["activeMembership"]>;
};

export async function requireActiveMembership(): Promise<ActiveDashboardContext> {
  const context = await getCurrentSessionContext();

  if (!context) {
    redirect("/auth");
  }

  if (
    (await getMaintenanceMode()) &&
    !context.user.isSuperAdmin
  ) {
    redirect("/?maintenance=1");
  }

  if (!context.activeMembership) {
    redirect("/dashboard/workspaces/new");
  }

  return context as ActiveDashboardContext;
}
