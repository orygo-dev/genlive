import type { ReactNode } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CreditCard,
  Settings,
  Users,
  Video,
} from "lucide-react";
import { OrgSwitcher } from "@/components/org-switcher";
import type { Membership } from "@/lib/organization-helpers";

type DashboardShellProps = {
  user: { name: string; email: string };
  memberships: Membership[];
  activeOrganizationId: string;
  activeNav: "meeting" | "members" | "billing" | "calendar" | "settings";
  children: ReactNode;
};

export function DashboardShell({
  user,
  memberships,
  activeOrganizationId,
  activeNav,
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
      <aside className="dashboard-sidebar">
        <Link className="brand dashboard-brand" href="/">
          <span className="brand-mark"><Video size={19} /></span>
          <span>GenMeet</span>
        </Link>

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
            className={activeNav === "settings" ? "active" : undefined}
            href="/dashboard/settings"
          >
            <Settings size={18} /> Pengaturan
          </Link>
        </nav>

        <div className="dashboard-user">
          <span className="dashboard-avatar">{initials}</span>
          <span>
            <strong>{user.name}</strong>
            <small>{user.email}</small>
          </span>
        </div>
      </aside>

      <main className="dashboard-main">{children}</main>
    </div>
  );
}
