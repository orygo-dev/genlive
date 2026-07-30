import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AdminBrandingPanel } from "@/components/admin-branding-panel";
import { AdminLogoutButton } from "@/components/admin-logout-button";
import { AppBrand } from "@/components/app-brand";
import { getPlatformBranding } from "@/lib/platform-settings";
import { requireSuperAdmin } from "@/lib/super-admin";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const context = await requireSuperAdmin();
  const branding = await getPlatformBranding();

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <AppBrand branding={branding} className="brand" markSize={18} />
        <div className="admin-topbar-actions">
          {context.activeMembership ? (
            <Link className="button button-ghost" href="/dashboard">
              <ArrowLeft size={16} /> Dashboard workspace
            </Link>
          ) : null}
          <AdminLogoutButton />
        </div>
      </header>
      <main className="admin-main">
        <AdminBrandingPanel
          initialBranding={branding}
          adminName={context.user.name}
        />
      </main>
    </div>
  );
}
