import { DashboardShell } from "@/components/dashboard-shell";
import { MeetingCalendar } from "@/components/meeting-calendar";
import { requireActiveMembership } from "@/lib/dashboard-guard";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const context = await requireActiveMembership();

  return (
    <DashboardShell
      user={context.user}
      memberships={context.user.memberships}
      activeOrganizationId={context.activeMembership.organization.id}
      activeNav="calendar"
    >
      <header className="dashboard-header">
        <div>
          <p>{context.activeMembership.organization.name}</p>
          <h1>Kalender meeting</h1>
        </div>
      </header>
      <MeetingCalendar
        organizationId={context.activeMembership.organization.id}
      />
    </DashboardShell>
  );
}
