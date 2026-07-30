import { DashboardShell } from "@/components/dashboard-shell";
import { BillingPanel } from "@/components/billing-panel";
import { requireActiveMembership } from "@/lib/dashboard-guard";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const context = await requireActiveMembership();

  return (
    <DashboardShell
      user={context.user}
      memberships={context.user.memberships}
      activeOrganizationId={context.activeMembership.organization.id}
      activeNav="billing"
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
