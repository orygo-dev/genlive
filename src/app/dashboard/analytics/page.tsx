import { AnalyticsPanel } from "@/components/analytics-panel";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireActiveMembership } from "@/lib/dashboard-guard";
import { getPlatformBranding } from "@/lib/platform-settings";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const context = await requireActiveMembership();
  const branding = await getPlatformBranding();

  return (
    <DashboardShell
      user={{
        name: context.user.name,
        email: context.user.email,
        isSuperAdmin: context.user.isSuperAdmin,
        emailVerifiedAt: context.user.emailVerifiedAt,
      }}
      memberships={context.user.memberships}
      activeOrganizationId={context.activeMembership.organization.id}
      activeNav="analytics"
      branding={branding}
    >
      <header className="dashboard-header">
        <div>
          <p>{context.activeMembership.organization.name}</p>
          <h1>Analytics</h1>
        </div>
      </header>
      <AnalyticsPanel />
    </DashboardShell>
  );
}
