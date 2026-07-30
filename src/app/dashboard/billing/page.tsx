import { DashboardShell } from "@/components/dashboard-shell";
import { BillingPanel } from "@/components/billing-panel";
import { requireActiveMembership } from "@/lib/dashboard-guard";
import { getPlatformBranding } from "@/lib/platform-settings";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const context = await requireActiveMembership();
  const branding = await getPlatformBranding();

  return (
    <DashboardShell
      user={{
        name: context.user.name,
        email: context.user.email,
        isSuperAdmin: context.user.isSuperAdmin,
      }}
      memberships={context.user.memberships}
      activeOrganizationId={context.activeMembership.organization.id}
      activeNav="billing"
      branding={branding}
    >
      <header className="dashboard-header">
        <div>
          <p>{context.activeMembership.organization.name}</p>
          <h1>Billing</h1>
        </div>
      </header>
      <BillingPanel />
    </DashboardShell>
  );
}
