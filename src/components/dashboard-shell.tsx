import type { ReactNode } from "react";
import Link from "next/link";
import {
  BarChart3,
  CalendarDays,
  CreditCard,
  Settings,
  Shield,
  Users,
  Video,
} from "lucide-react";
import { AppBrand } from "@/components/app-brand";
import { BrandPopupAd } from "@/components/brand-popup-ad";
import { EmailVerifyBanner } from "@/components/email-verify-banner";
import { OrgSwitcher } from "@/components/org-switcher";
import type { PlatformBranding } from "@/lib/platform-branding";
import type { Membership } from "@/lib/organization-helpers";

type DashboardShellProps = {
  user: {
    name: string;
    email: string;
    isSuperAdmin?: boolean;
    emailVerifiedAt?: string | Date | null;
  };
  memberships: Membership[];
  activeOrganizationId: string;
  activeNav: "meeting" | "members" | "billing" | "calendar" | "settings" | "analytics";
  branding: PlatformBranding;
  children: ReactNode;
};

export function DashboardShell({
  user,
  memberships,
  activeOrganizationId,
  activeNav,
  branding,
  children,
}: DashboardShellProps) {
  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="dashboard-shell">
      <BrandPopupAd popupAd={branding.mobilePopupAd} />
      <aside className="dashboard-sidebar">
        <AppBrand branding={branding} className="brand dashboard-brand" markSize={19} />

        <OrgSwitcher
          memberships={memberships.map((membership) => ({
            id: membership.organization.id,
            name: membership.organization.name,
            role: membership.role,
          }))}
          activeOrganizationId={activeOrganizationId}
        />

        <nav aria-label="Navigasi dashboard">
          <Link
            className={activeNav === "meeting" ? "active" : undefined}
            href="/dashboard"
          >
            <Video size={18} /> Meeting
          </Link>
          <Link
            className={activeNav === "calendar" ? "active" : undefined}
            href="/dashboard/calendar"
          >
            <CalendarDays size={18} /> Kalender
          </Link>
          <Link
            className={activeNav === "members" ? "active" : undefined}
            href="/dashboard/members"
          >
            <Users size={18} /> Anggota
          </Link>
          <Link
            className={activeNav === "billing" ? "active" : undefined}
            href="/dashboard/billing"
          >
            <CreditCard size={18} /> Billing
          </Link>
          <Link
            className={activeNav === "analytics" ? "active" : undefined}
            href="/dashboard/analytics"
          >
            <BarChart3 size={18} /> Analytics
          </Link>
          <Link
            className={activeNav === "settings" ? "active" : undefined}
            href="/dashboard/settings"
          >
            <Settings size={18} /> Pengaturan
          </Link>
          {user.isSuperAdmin ? (
            <Link href="/admin">
              <Shield size={18} /> Super Admin
            </Link>
          ) : null}
        </nav>

        <div className="dashboard-user">
          <span className="dashboard-avatar">{initials}</span>
          <span>
            <strong>{user.name}</strong>
            <small>{user.email}</small>
          </span>
        </div>
      </aside>
      <main className="dashboard-main">
        <EmailVerifyBanner emailVerified={Boolean(user.emailVerifiedAt)} />
        {children}
      </main>
    </div>
  );
}
