import { DashboardShell } from "@/components/dashboard-shell";
import { SettingsPanel } from "@/components/settings-panel";
import { requireActiveMembership } from "@/lib/dashboard-guard";
import { prisma } from "@/lib/db";
import { canManageMembers } from "@/lib/organization-helpers";
import { getPlatformBranding } from "@/lib/platform-settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const context = await requireActiveMembership();
  const branding = await getPlatformBranding();
  const { user, activeMembership } = context;
  const organization = activeMembership.organization;

  const orgDetails = await prisma.organization.findUniqueOrThrow({
    where: { id: organization.id },
    select: {
      planCode: true,
      recordingRetentionDays: true,
      brandName: true,
      logoUrl: true,
      primaryColor: true,
      customDomain: true,
      ssoEnabled: true,
      ssoTenantHint: true,
    },
  });

  return (
    <DashboardShell
      user={{
        name: user.name,
        email: user.email,
        isSuperAdmin: user.isSuperAdmin,
        emailVerifiedAt: user.emailVerifiedAt,
      }}
      memberships={user.memberships}
      activeOrganizationId={organization.id}
      activeNav="settings"
      branding={branding}
    >
      <header className="dashboard-header">
        <div>
          <p>{organization.name}</p>
          <h1>Pengaturan</h1>
        </div>
      </header>

      <SettingsPanel
        user={{ id: user.id, name: user.name, email: user.email }}
        organization={{
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          planCode: orgDetails.planCode,
          recordingRetentionDays: orgDetails.recordingRetentionDays,
          brandName: orgDetails.brandName,
          logoUrl: orgDetails.logoUrl,
          primaryColor: orgDetails.primaryColor,
          customDomain: orgDetails.customDomain,
          ssoEnabled: orgDetails.ssoEnabled,
          ssoTenantHint: orgDetails.ssoTenantHint,
        }}
        currentRole={activeMembership.role}
        canManageOrg={canManageMembers(activeMembership.role)}
        canDeleteOrg={activeMembership.role === "OWNER"}
        isOwner={activeMembership.role === "OWNER"}
        membershipCount={user.memberships.length}
      />
    </DashboardShell>
  );
}
