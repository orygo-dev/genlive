"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  Building2,
  CreditCard,
  LayoutDashboard,
  LoaderCircle,
  Palette,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { AdminBrandingPanel } from "@/components/admin-branding-panel";
import type { PlatformBranding } from "@/lib/platform-branding";
import { formatIdr } from "@/lib/plans";

type Tab = "overview" | "organizations" | "users" | "orders" | "branding";

type Overview = {
  userCount: number;
  organizationCount: number;
  proOrgCount: number;
  freeOrgCount: number;
  activeMeetingCount: number;
  meetingCount: number;
  paidOrderCount: number;
  pendingOrderCount: number;
  livekitConfigured: boolean;
  paymentProvider: string;
  appUrl: string | null;
};

type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  planCode: string;
  planExpiresAt: string | null;
  planName: string;
  memberCount: number;
  meetingCount: number;
  createdAt: string;
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  isSuperAdmin: boolean;
  createdAt: string;
  sessionCount: number;
  organizations: Array<{
    id: string;
    name: string;
    planCode: string;
    role: string;
  }>;
};

type OrderRow = {
  id: string;
  provider: string;
  status: string;
  amountIdr: number;
  planCode: string;
  orderId: string;
  providerRef: string | null;
  createdAt: string;
  paidAt: string | null;
  organization: { id: string; name: string; slug: string };
  createdBy: { id: string; name: string; email: string };
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function AdminConsole({
  initialBranding,
  adminName,
}: {
  initialBranding: PlatformBranding;
  adminName: string;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [orgQuery, setOrgQuery] = useState("");
  const [userQuery, setUserQuery] = useState("");
  const [orderStatus, setOrderStatus] = useState("");

  const loadOverview = useCallback(async () => {
    const response = await fetch("/api/admin/overview");
    const payload = (await response.json()) as { overview?: Overview; error?: string };
    if (!response.ok || !payload.overview) {
      throw new Error(payload.error ?? "Gagal memuat overview.");
    }
    setOverview(payload.overview);
  }, []);

  const loadOrganizations = useCallback(async (q = "") => {
    const response = await fetch(
      `/api/admin/organizations?q=${encodeURIComponent(q)}`,
    );
    const payload = (await response.json()) as {
      organizations?: OrganizationRow[];
      error?: string;
    };
    if (!response.ok || !payload.organizations) {
      throw new Error(payload.error ?? "Gagal memuat organisasi.");
    }
    setOrganizations(payload.organizations);
  }, []);

  const loadUsers = useCallback(async (q = "") => {
    const response = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}`);
    const payload = (await response.json()) as {
      users?: UserRow[];
      error?: string;
    };
    if (!response.ok || !payload.users) {
      throw new Error(payload.error ?? "Gagal memuat pengguna.");
    }
    setUsers(payload.users);
  }, []);

  const loadOrders = useCallback(async (status = "") => {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    const response = await fetch(`/api/admin/payment-orders${query}`);
    const payload = (await response.json()) as {
      orders?: OrderRow[];
      error?: string;
    };
    if (!response.ok || !payload.orders) {
      throw new Error(payload.error ?? "Gagal memuat order.");
    }
    setOrders(payload.orders);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setError("");
      setBusy(true);
      try {
        if (tab === "overview") await loadOverview();
        if (tab === "organizations") await loadOrganizations(orgQuery);
        if (tab === "users") await loadUsers(userQuery);
        if (tab === "orders") await loadOrders(orderStatus);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "Gagal memuat data.",
          );
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    }
    if (tab !== "branding") {
      void run();
    }
    return () => {
      cancelled = true;
    };
  }, [
    tab,
    loadOverview,
    loadOrganizations,
    loadUsers,
    loadOrders,
    orgQuery,
    userQuery,
    orderStatus,
  ]);

  async function setPlan(organizationId: string, planCode: "FREE" | "PRO") {
    setError("");
    setBusy(true);
    try {
      const response = await fetch(
        `/api/admin/organizations/${organizationId}/plan`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planCode,
            periodDays: planCode === "PRO" ? 30 : undefined,
          }),
        },
      );
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Gagal mengubah plan.");
      }
      await loadOrganizations(orgQuery);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Gagal mengubah plan.",
      );
    } finally {
      setBusy(false);
    }
  }

  function searchOrgs(event: FormEvent) {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    setOrgQuery(String(data.get("q") || "").trim());
  }

  function searchUsers(event: FormEvent) {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    setUserQuery(String(data.get("q") || "").trim());
  }

  const tabs: Array<{ id: Tab; label: string; icon: typeof LayoutDashboard }> = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "organizations", label: "Organisasi", icon: Building2 },
    { id: "users", label: "Pengguna", icon: Users },
    { id: "orders", label: "Pembayaran", icon: CreditCard },
    { id: "branding", label: "Branding", icon: Palette },
  ];

  return (
    <div className="admin-panel">
      <section className="admin-hero">
        <div className="admin-hero-icon">
          <LayoutDashboard size={22} />
        </div>
        <div>
          <p>Super Admin · {adminName}</p>
          <h1>Panel platform SaaS</h1>
          <p>
            Kelola tenant, plan, pengguna, pembayaran, dan identitas visual
            GenMeet.
          </p>
        </div>
      </section>

      <nav className="admin-tabs" aria-label="Menu Super Admin">
        {tabs.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className={tab === item.id ? "admin-tab active" : "admin-tab"}
              onClick={() => setTab(item.id)}
            >
              <Icon size={16} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {error ? <p className="form-error">{error}</p> : null}

      {tab === "overview" ? (
        <section className="admin-card">
          <div className="admin-card-head">
            <h2>Ringkasan platform</h2>
            <button
              type="button"
              className="button button-ghost"
              disabled={busy}
              onClick={() => void loadOverview()}
            >
              <RefreshCw size={16} /> Muat ulang
            </button>
          </div>
          {overview ? (
            <div className="admin-stats">
              <article>
                <strong>{overview.userCount}</strong>
                <span>Pengguna</span>
              </article>
              <article>
                <strong>{overview.organizationCount}</strong>
                <span>Organisasi</span>
              </article>
              <article>
                <strong>{overview.proOrgCount}</strong>
                <span>Plan Pro</span>
              </article>
              <article>
                <strong>{overview.freeOrgCount}</strong>
                <span>Plan Free</span>
              </article>
              <article>
                <strong>{overview.activeMeetingCount}</strong>
                <span>Meeting aktif</span>
              </article>
              <article>
                <strong>{overview.meetingCount}</strong>
                <span>Total meeting</span>
              </article>
              <article>
                <strong>{overview.paidOrderCount}</strong>
                <span>Order PAID</span>
              </article>
              <article>
                <strong>{overview.pendingOrderCount}</strong>
                <span>Order PENDING</span>
              </article>
            </div>
          ) : (
            <p className="admin-muted">
              {busy ? <LoaderCircle className="spin" size={18} /> : null} Memuat…
            </p>
          )}
          {overview ? (
            <ul className="admin-meta-list">
              <li>
                LiveKit:{" "}
                <strong>
                  {overview.livekitConfigured ? "terkonfigurasi" : "belum lengkap"}
                </strong>
              </li>
              <li>
                Gateway pembayaran: <strong>{overview.paymentProvider}</strong>
              </li>
              <li>
                APP_URL: <strong>{overview.appUrl || "—"}</strong>
              </li>
            </ul>
          ) : null}
        </section>
      ) : null}

      {tab === "organizations" ? (
        <section className="admin-card">
          <div className="admin-card-head">
            <h2>Organisasi / tenant</h2>
            <form className="admin-search" onSubmit={searchOrgs}>
              <Search size={16} />
              <input name="q" placeholder="Cari nama atau slug…" defaultValue={orgQuery} />
              <button className="button button-ghost" type="submit">
                Cari
              </button>
            </form>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Organisasi</th>
                  <th>Plan</th>
                  <th>Anggota</th>
                  <th>Meeting</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {organizations.map((org) => (
                  <tr key={org.id}>
                    <td>
                      <strong>{org.name}</strong>
                      <span className="admin-sub">{org.slug}</span>
                    </td>
                    <td>
                      <strong>{org.planCode}</strong>
                      <span className="admin-sub">
                        Exp: {formatDate(org.planExpiresAt)}
                      </span>
                    </td>
                    <td>{org.memberCount}</td>
                    <td>{org.meetingCount}</td>
                    <td className="admin-actions">
                      <button
                        type="button"
                        className="button button-ghost"
                        disabled={busy || org.planCode === "PRO"}
                        onClick={() => void setPlan(org.id, "PRO")}
                      >
                        Grant Pro 30 hari
                      </button>
                      <button
                        type="button"
                        className="button button-ghost"
                        disabled={busy || org.planCode === "FREE"}
                        onClick={() => void setPlan(org.id, "FREE")}
                      >
                        Set Free
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {organizations.length === 0 ? (
              <p className="admin-muted">Belum ada organisasi.</p>
            ) : null}
          </div>
        </section>
      ) : null}

      {tab === "users" ? (
        <section className="admin-card">
          <div className="admin-card-head">
            <h2>Pengguna</h2>
            <form className="admin-search" onSubmit={searchUsers}>
              <Search size={16} />
              <input name="q" placeholder="Cari nama atau email…" defaultValue={userQuery} />
              <button className="button button-ghost" type="submit">
                Cari
              </button>
            </form>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Pengguna</th>
                  <th>Peran</th>
                  <th>Workspace</th>
                  <th>Dibuat</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.name}</strong>
                      <span className="admin-sub">{user.email}</span>
                    </td>
                    <td>
                      {user.isSuperAdmin ? (
                        <span className="admin-badge">Super Admin</span>
                      ) : (
                        "User"
                      )}
                    </td>
                    <td>
                      {user.organizations.length === 0
                        ? "—"
                        : user.organizations
                            .map((o) => `${o.name} (${o.role}/${o.planCode})`)
                            .join(", ")}
                    </td>
                    <td>{formatDate(user.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 ? (
              <p className="admin-muted">Belum ada pengguna.</p>
            ) : null}
          </div>
        </section>
      ) : null}

      {tab === "orders" ? (
        <section className="admin-card">
          <div className="admin-card-head">
            <h2>Order pembayaran</h2>
            <select
              className="admin-select"
              value={orderStatus}
              onChange={(event) => setOrderStatus(event.target.value)}
            >
              <option value="">Semua status</option>
              <option value="PENDING">PENDING</option>
              <option value="PAID">PAID</option>
              <option value="FAILED">FAILED</option>
              <option value="EXPIRED">EXPIRED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Organisasi</th>
                  <th>Plan</th>
                  <th>Jumlah</th>
                  <th>Status</th>
                  <th>Waktu</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <strong>{order.orderId}</strong>
                      <span className="admin-sub">
                        {order.provider}
                        {order.providerRef ? ` · ${order.providerRef}` : ""}
                      </span>
                    </td>
                    <td>
                      {order.organization.name}
                      <span className="admin-sub">{order.createdBy.email}</span>
                    </td>
                    <td>{order.planCode}</td>
                    <td>{formatIdr(order.amountIdr)}</td>
                    <td>
                      <span className="admin-badge">{order.status}</span>
                    </td>
                    <td>
                      {formatDate(order.createdAt)}
                      {order.paidAt ? (
                        <span className="admin-sub">
                          Paid: {formatDate(order.paidAt)}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {orders.length === 0 ? (
              <p className="admin-muted">Belum ada order.</p>
            ) : null}
          </div>
        </section>
      ) : null}

      {tab === "branding" ? (
        <AdminBrandingPanel
          initialBranding={initialBranding}
          adminName={adminName}
        />
      ) : null}
    </div>
  );
}
