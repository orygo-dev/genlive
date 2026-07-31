"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  Activity,
  Building2,
  CreditCard,
  HardDrive,
  LayoutDashboard,
  LoaderCircle,
  Palette,
  PlugZap,
  RefreshCw,
  ScrollText,
  Search,
  Server,
  Shield,
  Users,
  Video,
} from "lucide-react";
import { AdminBrandingPanel } from "@/components/admin-branding-panel";
import { AdminIntegrationsPanel } from "@/components/admin-integrations-panel";
import type { PlatformBranding } from "@/lib/platform-branding";
import { formatIdr, type PlanDefinition } from "@/lib/plans";

type Tab =
  | "overview"
  | "integrations"
  | "organizations"
  | "users"
  | "meetings"
  | "recordings"
  | "orders"
  | "audit"
  | "plans"
  | "system"
  | "branding";

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
  recentUsers: Array<{
    id: string;
    name: string;
    email: string;
    createdAt: string;
    isDisabled: boolean;
  }>;
  recentOrganizations: Array<{
    id: string;
    name: string;
    slug: string;
    planCode: string;
    createdAt: string;
  }>;
  recentOrders: Array<{
    id: string;
    orderId: string;
    status: string;
    amountIdr: number;
    createdAt: string;
    organization: { name: string };
  }>;
  recentMeetings: Array<{
    id: string;
    title: string;
    status: string;
    roomName: string;
    createdAt: string;
    organization: { name: string };
  }>;
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
  isDisabled: boolean;
  createdAt: string;
  sessionCount: number;
  organizations: Array<{
    id: string;
    name: string;
    planCode: string;
    role: string;
  }>;
};

type MeetingRow = {
  id: string;
  title: string;
  roomName: string;
  status: string;
  startsAt: string | null;
  createdAt: string;
  organization: { id: string; name: string; slug: string };
  createdBy: { id: string; name: string; email: string };
  _count: { participants: number; recordings: number };
};

type RecordingRow = {
  id: string;
  egressId: string;
  status: string;
  durationSeconds: number | null;
  downloadUrl: string | null;
  errorMessage: string | null;
  startedAt: string;
  organization: { id: string; name: string };
  meeting: { id: string; title: string; roomName: string };
  startedBy: { id: string; name: string; email: string } | null;
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

type AuditRow = {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  createdAt: string;
  organization: { id: string; name: string; slug: string };
  actor: { id: string; name: string; email: string } | null;
};

type SystemInfo = {
  appName: string;
  supportEmail: string | null;
  maintenanceMode: boolean;
  updatedAt: string;
  appUrl: string | null;
  nodeEnv: string | null;
  paymentProvider: string;
  livekitConfigured: boolean;
  emailConfigured: boolean;
  whatsappConfigured: boolean;
  cronConfigured: boolean;
  superAdminEmails: string[];
  activeSessions: number;
  disabledUsers: number;
  failedRecordings: number;
  plans: PlanDefinition[];
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

const NAV: Array<{ id: Tab; label: string; icon: typeof LayoutDashboard; group: string }> = [
  { id: "overview", label: "Dashboard", icon: LayoutDashboard, group: "Utama" },
  { id: "integrations", label: "Integrasi", icon: PlugZap, group: "Platform" },
  { id: "organizations", label: "Organisasi", icon: Building2, group: "Tenant" },
  { id: "users", label: "Pengguna", icon: Users, group: "Tenant" },
  { id: "meetings", label: "Meeting", icon: Video, group: "Operasional" },
  { id: "recordings", label: "Recording", icon: HardDrive, group: "Operasional" },
  { id: "orders", label: "Billing", icon: CreditCard, group: "Monetisasi" },
  { id: "plans", label: "Katalog Plan", icon: Shield, group: "Monetisasi" },
  { id: "audit", label: "Audit Log", icon: ScrollText, group: "Keamanan" },
  { id: "system", label: "Sistem", icon: Server, group: "Platform" },
  { id: "branding", label: "Branding", icon: Palette, group: "Platform" },
];

export function AdminConsole({
  initialBranding,
  adminName,
}: {
  initialBranding: PlatformBranding;
  adminName: string;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [recordings, setRecordings] = useState<RecordingRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [orgQuery, setOrgQuery] = useState("");
  const [userQuery, setUserQuery] = useState("");
  const [meetingQuery, setMeetingQuery] = useState("");
  const [meetingStatus, setMeetingStatus] = useState("");
  const [recordingStatus, setRecordingStatus] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [auditQuery, setAuditQuery] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  const loadOverview = useCallback(async () => {
    const response = await fetch("/api/admin/overview");
    const payload = (await response.json()) as { overview?: Overview; error?: string };
    if (!response.ok || !payload.overview) throw new Error(payload.error ?? "Gagal memuat dashboard.");
    setOverview(payload.overview);
  }, []);

  const loadOrganizations = useCallback(async (q = "") => {
    const response = await fetch(`/api/admin/organizations?q=${encodeURIComponent(q)}`);
    const payload = (await response.json()) as { organizations?: OrganizationRow[]; error?: string };
    if (!response.ok || !payload.organizations) throw new Error(payload.error ?? "Gagal memuat organisasi.");
    setOrganizations(payload.organizations);
  }, []);

  const loadUsers = useCallback(async (q = "") => {
    const response = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}`);
    const payload = (await response.json()) as { users?: UserRow[]; error?: string };
    if (!response.ok || !payload.users) throw new Error(payload.error ?? "Gagal memuat pengguna.");
    setUsers(payload.users);
  }, []);

  const loadMeetings = useCallback(async (q = "", status = "") => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    const response = await fetch(`/api/admin/meetings?${params.toString()}`);
    const payload = (await response.json()) as { meetings?: MeetingRow[]; error?: string };
    if (!response.ok || !payload.meetings) throw new Error(payload.error ?? "Gagal memuat meeting.");
    setMeetings(payload.meetings);
  }, []);

  const loadRecordings = useCallback(async (status = "") => {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    const response = await fetch(`/api/admin/recordings${query}`);
    const payload = (await response.json()) as { recordings?: RecordingRow[]; error?: string };
    if (!response.ok || !payload.recordings) throw new Error(payload.error ?? "Gagal memuat recording.");
    setRecordings(payload.recordings);
  }, []);

  const loadOrders = useCallback(async (status = "") => {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    const response = await fetch(`/api/admin/payment-orders${query}`);
    const payload = (await response.json()) as { orders?: OrderRow[]; error?: string };
    if (!response.ok || !payload.orders) throw new Error(payload.error ?? "Gagal memuat billing.");
    setOrders(payload.orders);
  }, []);

  const loadAudit = useCallback(async (q = "") => {
    const response = await fetch(`/api/admin/audit-logs?q=${encodeURIComponent(q)}`);
    const payload = (await response.json()) as { logs?: AuditRow[]; error?: string };
    if (!response.ok || !payload.logs) throw new Error(payload.error ?? "Gagal memuat audit.");
    setLogs(payload.logs);
  }, []);

  const loadSystem = useCallback(async () => {
    const response = await fetch("/api/admin/system");
    const payload = (await response.json()) as { system?: SystemInfo; error?: string };
    if (!response.ok || !payload.system) throw new Error(payload.error ?? "Gagal memuat sistem.");
    setSystem(payload.system);
    setSupportEmail(payload.system.supportEmail || "");
    setMaintenanceMode(payload.system.maintenanceMode);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setError("");
      setMessage("");
      setBusy(true);
      try {
        if (tab === "overview") await loadOverview();
        if (tab === "organizations") await loadOrganizations(orgQuery);
        if (tab === "users") await loadUsers(userQuery);
        if (tab === "meetings") await loadMeetings(meetingQuery, meetingStatus);
        if (tab === "recordings") await loadRecordings(recordingStatus);
        if (tab === "orders") await loadOrders(orderStatus);
        if (tab === "audit") await loadAudit(auditQuery);
        if (tab === "plans" || tab === "system") await loadSystem();
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Gagal memuat data.");
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    }
    if (tab !== "branding" && tab !== "integrations") void run();
    return () => {
      cancelled = true;
    };
  }, [
    tab,
    orgQuery,
    userQuery,
    meetingQuery,
    meetingStatus,
    recordingStatus,
    orderStatus,
    auditQuery,
    loadOverview,
    loadOrganizations,
    loadUsers,
    loadMeetings,
    loadRecordings,
    loadOrders,
    loadAudit,
    loadSystem,
  ]);

  async function setPlan(organizationId: string, planCode: "FREE" | "PRO") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/organizations/${organizationId}/plan`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planCode,
          periodDays: planCode === "PRO" ? 30 : undefined,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Gagal mengubah plan.");
      setMessage(`Plan organisasi diubah ke ${planCode}.`);
      await loadOrganizations(orgQuery);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Gagal mengubah plan.");
    } finally {
      setBusy(false);
    }
  }

  async function patchUser(
    userId: string,
    body: {
      name?: string;
      email?: string;
      password?: string;
      isDisabled?: boolean;
      isSuperAdmin?: boolean;
      revokeSessions?: boolean;
    },
  ) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Gagal memperbarui pengguna.");
      setMessage("Pengguna diperbarui.");
      await loadUsers(userQuery);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Gagal memperbarui pengguna.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteUser(userId: string, label: string) {
    if (!window.confirm(`Hapus pengguna ${label}?`)) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Gagal menghapus pengguna.");
      setMessage("Pengguna dihapus.");
      await loadUsers(userQuery);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Gagal menghapus pengguna.");
    } finally {
      setBusy(false);
    }
  }

  async function meetingAction(meetingId: string, action: "end" | "cancel") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/meetings/${meetingId}/${action}`, {
        method: "POST",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? `Gagal ${action === "end" ? "mengakhiri" : "membatalkan"} meeting.`);
      }
      setMessage(action === "end" ? "Meeting diakhiri." : "Meeting dibatalkan.");
      await loadMeetings(meetingQuery, meetingStatus);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Aksi meeting gagal.");
    } finally {
      setBusy(false);
    }
  }

  async function orderAction(orderId: string, action: "cancel" | "refund") {
    const label = action === "cancel" ? "membatalkan order" : "merefund order";
    if (!window.confirm(`Yakin ingin ${label} ini?`)) return;

    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/payment-orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? `Gagal ${label}.`);
      }
      setMessage(action === "cancel" ? "Order dibatalkan." : "Order direfund (status sistem).");
      await loadOrders(orderStatus);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : `Gagal ${label}.`);
    } finally {
      setBusy(false);
    }
  }

  async function savePlans(event: FormEvent) {
    event.preventDefault();
    if (!system) return;
    setBusy(true);
    setError("");
    try {
      const byCode = Object.fromEntries(system.plans.map((plan) => [plan.code, plan]));
      const free = byCode.FREE;
      const pro = byCode.PRO;
      if (!free || !pro) throw new Error("Katalog plan tidak lengkap.");

      const response = await fetch("/api/admin/plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          FREE: {
            name: free.name,
            priceIdr: free.priceIdr,
            billingPeriodDays: free.billingPeriodDays,
            maxMembers: free.maxMembers,
            maxMeetingsPerMonth: free.maxMeetingsPerMonth,
            maxMeetingMinutesPerMonth: free.maxMeetingMinutesPerMonth,
            maxRecordingMinutesPerMonth: free.maxRecordingMinutesPerMonth,
            features: free.features,
          },
          PRO: {
            name: pro.name,
            priceIdr: pro.priceIdr,
            billingPeriodDays: pro.billingPeriodDays,
            maxMembers: pro.maxMembers,
            maxMeetingsPerMonth: pro.maxMeetingsPerMonth,
            maxMeetingMinutesPerMonth: pro.maxMeetingMinutesPerMonth,
            maxRecordingMinutesPerMonth: pro.maxRecordingMinutesPerMonth,
            features: pro.features,
          },
        }),
      });
      const payload = (await response.json()) as { error?: string; plans?: PlanDefinition[] };
      if (!response.ok) throw new Error(payload.error ?? "Gagal menyimpan plan.");
      setMessage("Katalog plan disimpan.");
      await loadSystem();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Gagal menyimpan plan.");
    } finally {
      setBusy(false);
    }
  }

  function updatePlanField(
    code: "FREE" | "PRO",
    field: keyof PlanDefinition,
    value: string | number | string[],
  ) {
    setSystem((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        plans: prev.plans.map((plan) =>
          plan.code === code ? { ...plan, [field]: value } : plan,
        ),
      };
    });
  }

  async function saveSystem(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/system/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supportEmail: supportEmail.trim() || "",
          maintenanceMode,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Gagal menyimpan sistem.");
      setMessage("Pengaturan sistem disimpan.");
      await loadSystem();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Gagal menyimpan sistem.");
    } finally {
      setBusy(false);
    }
  }

  const groups = Array.from(new Set(NAV.map((item) => item.group)));

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <Shield size={18} />
          <div>
            <strong>Control Plane</strong>
            <span>{adminName}</span>
          </div>
        </div>
        {groups.map((group) => (
          <div key={group} className="admin-nav-group">
            <p>{group}</p>
            {NAV.filter((item) => item.group === group).map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={tab === item.id ? "admin-nav-item active" : "admin-nav-item"}
                  onClick={() => setTab(item.id)}
                >
                  <Icon size={16} />
                  {item.label}
                </button>
              );
            })}
          </div>
        ))}
      </aside>

      <div className="admin-content">
        {error ? <p className="form-error">{error}</p> : null}
        {message ? <p className="form-success">{message}</p> : null}
        {busy ? (
          <p className="admin-muted">
            <LoaderCircle className="spin" size={16} /> Memuat data…
          </p>
        ) : null}

        {tab === "overview" && overview ? (
          <section className="admin-card">
            <div className="admin-card-head">
              <div>
                <h2>Dashboard platform</h2>
                <p className="admin-muted">Ringkasan operasional SaaS GenMeet.</p>
              </div>
              <button type="button" className="button button-ghost" onClick={() => void loadOverview()}>
                <RefreshCw size={16} /> Refresh
              </button>
            </div>
            <div className="admin-stats">
              <article><strong>{overview.userCount}</strong><span>Pengguna</span></article>
              <article><strong>{overview.organizationCount}</strong><span>Organisasi</span></article>
              <article><strong>{overview.proOrgCount}</strong><span>Plan Pro</span></article>
              <article><strong>{overview.freeOrgCount}</strong><span>Plan Free</span></article>
              <article><strong>{overview.activeMeetingCount}</strong><span>Meeting aktif</span></article>
              <article><strong>{overview.meetingCount}</strong><span>Total meeting</span></article>
              <article><strong>{overview.paidOrderCount}</strong><span>Order PAID</span></article>
              <article><strong>{overview.pendingOrderCount}</strong><span>Order PENDING</span></article>
            </div>
            <div className="admin-grid-2">
              <div>
                <h3>User terbaru</h3>
                <ul className="admin-feed">
                  {overview.recentUsers.map((user) => (
                    <li key={user.id}>
                      <strong>{user.name}</strong>
                      <span>{user.email}</span>
                      <span>{formatDate(user.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>Organisasi terbaru</h3>
                <ul className="admin-feed">
                  {overview.recentOrganizations.map((org) => (
                    <li key={org.id}>
                      <strong>{org.name}</strong>
                      <span>{org.planCode}</span>
                      <span>{formatDate(org.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>Order terbaru</h3>
                <ul className="admin-feed">
                  {overview.recentOrders.map((order) => (
                    <li key={order.id}>
                      <strong>{order.organization.name}</strong>
                      <span>{order.status} · {formatIdr(order.amountIdr)}</span>
                      <span>{formatDate(order.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>Meeting terbaru</h3>
                <ul className="admin-feed">
                  {overview.recentMeetings.map((meeting) => (
                    <li key={meeting.id}>
                      <strong>{meeting.title}</strong>
                      <span>{meeting.organization.name} · {meeting.status}</span>
                      <span>{formatDate(meeting.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        ) : null}

        {tab === "organizations" ? (
          <section className="admin-card">
            <div className="admin-card-head">
              <h2>Organisasi / tenant</h2>
              <form
                className="admin-search"
                onSubmit={(event) => {
                  event.preventDefault();
                  const data = new FormData(event.currentTarget);
                  setOrgQuery(String(data.get("q") || "").trim());
                }}
              >
                <Search size={16} />
                <input name="q" defaultValue={orgQuery} placeholder="Cari organisasi…" />
                <button className="button button-ghost" type="submit">Cari</button>
              </form>
            </div>
            <form
              className="admin-inline-form"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                void (async () => {
                  setBusy(true);
                  setError("");
                  try {
                    const response = await fetch("/api/admin/organizations", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        name: String(data.get("name") || ""),
                        ownerEmail: String(data.get("ownerEmail") || "") || undefined,
                        planCode: String(data.get("planCode") || "FREE"),
                      }),
                    });
                    const payload = (await response.json()) as { error?: string };
                    if (!response.ok) throw new Error(payload.error ?? "Gagal membuat organisasi.");
                    setMessage("Organisasi dibuat.");
                    (event.target as HTMLFormElement).reset();
                    await loadOrganizations(orgQuery);
                  } catch (createError) {
                    setError(createError instanceof Error ? createError.message : "Gagal membuat.");
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            >
              <input name="name" placeholder="Nama organisasi" required />
              <input name="ownerEmail" placeholder="Email owner (opsional)" />
              <select name="planCode" defaultValue="FREE">
                <option value="FREE">FREE</option>
                <option value="PRO">PRO</option>
              </select>
              <button className="button" type="submit" disabled={busy}>Buat org</button>
            </form>
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
                        <span className="admin-sub">Exp: {formatDate(org.planExpiresAt)}</span>
                      </td>
                      <td>{org.memberCount}</td>
                      <td>{org.meetingCount}</td>
                      <td className="admin-actions">
                        <button type="button" className="button button-ghost" disabled={busy} onClick={() => void setPlan(org.id, "PRO")}>
                          Grant Pro 30 hari
                        </button>
                        <button type="button" className="button button-ghost" disabled={busy} onClick={() => void setPlan(org.id, "FREE")}>
                          Set Free
                        </button>
                        <button
                          type="button"
                          className="button button-ghost"
                          disabled={busy}
                          onClick={() => {
                            if (!window.confirm(`Hapus organisasi ${org.name}?`)) return;
                            void (async () => {
                              setBusy(true);
                              try {
                                const response = await fetch(`/api/admin/organizations/${org.id}`, {
                                  method: "DELETE",
                                });
                                const payload = (await response.json()) as { error?: string };
                                if (!response.ok) throw new Error(payload.error ?? "Gagal hapus.");
                                setMessage("Organisasi dihapus.");
                                await loadOrganizations(orgQuery);
                              } catch (deleteError) {
                                setError(deleteError instanceof Error ? deleteError.message : "Gagal hapus.");
                              } finally {
                                setBusy(false);
                              }
                            })();
                          }}
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {tab === "users" ? (
          <section className="admin-card">
            <div className="admin-card-head">
              <h2>Pengguna platform</h2>
              <form
                className="admin-search"
                onSubmit={(event) => {
                  event.preventDefault();
                  const data = new FormData(event.currentTarget);
                  setUserQuery(String(data.get("q") || "").trim());
                }}
              >
                <Search size={16} />
                <input name="q" defaultValue={userQuery} placeholder="Cari nama/email…" />
                <button className="button button-ghost" type="submit">Cari</button>
              </form>
            </div>
            <form
              className="admin-inline-form"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                void (async () => {
                  setBusy(true);
                  setError("");
                  try {
                    const response = await fetch("/api/admin/users", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        name: String(data.get("name") || ""),
                        email: String(data.get("email") || ""),
                        password: String(data.get("password") || ""),
                        isSuperAdmin: data.get("isSuperAdmin") === "on",
                      }),
                    });
                    const payload = (await response.json()) as { error?: string };
                    if (!response.ok) throw new Error(payload.error ?? "Gagal membuat pengguna.");
                    setMessage("Pengguna dibuat.");
                    (event.target as HTMLFormElement).reset();
                    await loadUsers(userQuery);
                  } catch (createError) {
                    setError(createError instanceof Error ? createError.message : "Gagal membuat.");
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            >
              <input name="name" placeholder="Nama" required />
              <input name="email" type="email" placeholder="Email" required />
              <input name="password" type="password" placeholder="Password" required minLength={8} />
              <label className="admin-check">
                <input name="isSuperAdmin" type="checkbox" /> Super Admin
              </label>
              <button className="button" type="submit" disabled={busy}>Buat user</button>
            </form>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Pengguna</th>
                    <th>Status</th>
                    <th>Workspace</th>
                    <th>Sesi</th>
                    <th>Aksi</th>
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
                        {user.isSuperAdmin ? <span className="admin-badge">Super Admin</span> : null}{" "}
                        {user.isDisabled ? <span className="admin-badge danger">Disabled</span> : <span className="admin-badge">Aktif</span>}
                      </td>
                      <td>
                        {user.organizations.length === 0
                          ? "—"
                          : user.organizations.map((o) => `${o.name} (${o.role})`).join(", ")}
                      </td>
                      <td>{user.sessionCount}</td>
                      <td className="admin-actions">
                        <button
                          type="button"
                          className="button button-ghost"
                          disabled={busy}
                          onClick={() =>
                            void patchUser(user.id, { isDisabled: !user.isDisabled })
                          }
                        >
                          {user.isDisabled ? "Aktifkan" : "Nonaktifkan"}
                        </button>
                        <button
                          type="button"
                          className="button button-ghost"
                          disabled={busy}
                          onClick={() => void patchUser(user.id, { revokeSessions: true })}
                        >
                          Revoke sesi
                        </button>
                        <button
                          type="button"
                          className="button button-ghost"
                          disabled={busy}
                          onClick={() => {
                            const password = window.prompt("Password baru (min. 8 karakter):");
                            if (!password) return;
                            void patchUser(user.id, { password, revokeSessions: true });
                          }}
                        >
                          Reset password
                        </button>
                        <button
                          type="button"
                          className="button button-ghost"
                          disabled={busy}
                          onClick={() => void deleteUser(user.id, user.email)}
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {tab === "meetings" ? (
          <section className="admin-card">
            <div className="admin-card-head">
              <h2>Meeting global</h2>
              <div className="admin-filters">
                <form
                  className="admin-search"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget);
                    setMeetingQuery(String(data.get("q") || "").trim());
                  }}
                >
                  <Search size={16} />
                  <input name="q" defaultValue={meetingQuery} placeholder="Judul / room…" />
                  <button className="button button-ghost" type="submit">Cari</button>
                </form>
                <select className="admin-select" value={meetingStatus} onChange={(e) => setMeetingStatus(e.target.value)}>
                  <option value="">Semua status</option>
                  <option value="SCHEDULED">SCHEDULED</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="ENDED">ENDED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Meeting</th>
                    <th>Organisasi</th>
                    <th>Status</th>
                    <th>Partisipan</th>
                    <th>Dibuat</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {meetings.map((meeting) => (
                    <tr key={meeting.id}>
                      <td>
                        <strong>{meeting.title}</strong>
                        <span className="admin-sub">{meeting.roomName}</span>
                      </td>
                      <td>
                        {meeting.organization.name}
                        <span className="admin-sub">{meeting.createdBy.email}</span>
                      </td>
                      <td><span className="admin-badge">{meeting.status}</span></td>
                      <td>{meeting._count.participants}</td>
                      <td>{formatDate(meeting.createdAt)}</td>
                      <td className="admin-actions">
                        {meeting.status === "ACTIVE" || meeting.status === "SCHEDULED" ? (
                          <>
                            <button
                              type="button"
                              className="button button-ghost"
                              disabled={busy}
                              onClick={() => {
                                if (!window.confirm(`Akhiri meeting "${meeting.title}"?`)) return;
                                void meetingAction(meeting.id, "end");
                              }}
                            >
                              Force end
                            </button>
                            <button
                              type="button"
                              className="button button-ghost"
                              disabled={busy}
                              onClick={() => {
                                if (!window.confirm(`Batalkan meeting "${meeting.title}"?`)) return;
                                void meetingAction(meeting.id, "cancel");
                              }}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {tab === "recordings" ? (
          <section className="admin-card">
            <div className="admin-card-head">
              <h2>Recording cloud</h2>
              <select className="admin-select" value={recordingStatus} onChange={(e) => setRecordingStatus(e.target.value)}>
                <option value="">Semua status</option>
                <option value="COMPLETE">COMPLETE</option>
                <option value="FAILED">FAILED</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="STARTING">STARTING</option>
              </select>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Meeting</th>
                    <th>Organisasi</th>
                    <th>Status</th>
                    <th>Durasi</th>
                    <th>Mulai</th>
                  </tr>
                </thead>
                <tbody>
                  {recordings.map((recording) => (
                    <tr key={recording.id}>
                      <td>
                        <strong>{recording.meeting.title}</strong>
                        <span className="admin-sub">{recording.egressId}</span>
                      </td>
                      <td>{recording.organization.name}</td>
                      <td>
                        <span className="admin-badge">{recording.status}</span>
                        {recording.errorMessage ? (
                          <span className="admin-sub">{recording.errorMessage}</span>
                        ) : null}
                      </td>
                      <td>
                        {recording.durationSeconds != null
                          ? `${Math.round(recording.durationSeconds / 60)} mnt`
                          : "—"}
                      </td>
                      <td>{formatDate(recording.startedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {tab === "orders" ? (
          <section className="admin-card">
            <div className="admin-card-head">
              <h2>Billing & order</h2>
              <select className="admin-select" value={orderStatus} onChange={(e) => setOrderStatus(e.target.value)}>
                <option value="">Semua status</option>
                <option value="PENDING">PENDING</option>
                <option value="PAID">PAID</option>
                <option value="FAILED">FAILED</option>
                <option value="EXPIRED">EXPIRED</option>
                <option value="CANCELLED">CANCELLED</option>
                <option value="REFUNDED">REFUNDED</option>
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
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <strong>{order.orderId}</strong>
                        <span className="admin-sub">{order.provider}</span>
                      </td>
                      <td>
                        {order.organization.name}
                        <span className="admin-sub">{order.createdBy.email}</span>
                      </td>
                      <td>{order.planCode}</td>
                      <td>{formatIdr(order.amountIdr)}</td>
                      <td><span className="admin-badge">{order.status}</span></td>
                      <td>{formatDate(order.createdAt)}</td>
                      <td>
                        <div className="admin-row-actions">
                          {order.status === "PENDING" ? (
                            <button
                              type="button"
                              className="button button-ghost"
                              disabled={busy}
                              onClick={() => void orderAction(order.id, "cancel")}
                            >
                              Batalkan
                            </button>
                          ) : null}
                          {order.status === "PAID" ? (
                            <button
                              type="button"
                              className="button button-ghost"
                              disabled={busy}
                              onClick={() => void orderAction(order.id, "refund")}
                            >
                              Refund
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {tab === "plans" && system ? (
          <section className="admin-card">
            <div className="admin-card-head">
              <h2>Katalog plan</h2>
              <p className="admin-muted">Edit kuota, harga, dan fitur Free / Pro.</p>
            </div>
            <form className="admin-plan-editor" onSubmit={savePlans}>
              <div className="admin-plan-grid">
                {system.plans.map((plan) => (
                  <article key={plan.code} className="admin-plan-card">
                    <h3>{plan.code}</h3>
                    <label>
                      Nama
                      <input
                        value={plan.name}
                        onChange={(e) => updatePlanField(plan.code, "name", e.target.value)}
                      />
                    </label>
                    <label>
                      Harga (IDR)
                      <input
                        type="number"
                        min={0}
                        value={plan.priceIdr}
                        onChange={(e) =>
                          updatePlanField(plan.code, "priceIdr", Number(e.target.value) || 0)
                        }
                      />
                    </label>
                    <label>
                      Periode (hari)
                      <input
                        type="number"
                        min={0}
                        value={plan.billingPeriodDays}
                        onChange={(e) =>
                          updatePlanField(
                            plan.code,
                            "billingPeriodDays",
                            Number(e.target.value) || 0,
                          )
                        }
                      />
                    </label>
                    <label>
                      Max anggota
                      <input
                        type="number"
                        min={1}
                        value={plan.maxMembers}
                        onChange={(e) =>
                          updatePlanField(plan.code, "maxMembers", Number(e.target.value) || 1)
                        }
                      />
                    </label>
                    <label>
                      Meeting / bulan
                      <input
                        type="number"
                        min={1}
                        value={plan.maxMeetingsPerMonth}
                        onChange={(e) =>
                          updatePlanField(
                            plan.code,
                            "maxMeetingsPerMonth",
                            Number(e.target.value) || 1,
                          )
                        }
                      />
                    </label>
                    <label>
                      Menit meeting / bulan
                      <input
                        type="number"
                        min={0}
                        value={plan.maxMeetingMinutesPerMonth}
                        onChange={(e) =>
                          updatePlanField(
                            plan.code,
                            "maxMeetingMinutesPerMonth",
                            Number(e.target.value) || 0,
                          )
                        }
                      />
                    </label>
                    <label>
                      Menit recording / bulan
                      <input
                        type="number"
                        min={0}
                        value={plan.maxRecordingMinutesPerMonth}
                        onChange={(e) =>
                          updatePlanField(
                            plan.code,
                            "maxRecordingMinutesPerMonth",
                            Number(e.target.value) || 0,
                          )
                        }
                      />
                    </label>
                    <label>
                      Fitur (satu baris = satu fitur)
                      <textarea
                        rows={5}
                        value={plan.features.join("\n")}
                        onChange={(e) =>
                          updatePlanField(
                            plan.code,
                            "features",
                            e.target.value
                              .split("\n")
                              .map((line) => line.trim())
                              .filter(Boolean),
                          )
                        }
                      />
                    </label>
                    <p className="admin-muted">Preview: {formatIdr(plan.priceIdr)}</p>
                  </article>
                ))}
              </div>
              <button className="button" type="submit" disabled={busy}>
                Simpan katalog plan
              </button>
            </form>
          </section>
        ) : null}

        {tab === "audit" ? (
          <section className="admin-card">
            <div className="admin-card-head">
              <h2>Audit log</h2>
              <form
                className="admin-search"
                onSubmit={(event) => {
                  event.preventDefault();
                  const data = new FormData(event.currentTarget);
                  setAuditQuery(String(data.get("q") || "").trim());
                }}
              >
                <Search size={16} />
                <input name="q" defaultValue={auditQuery} placeholder="Cari aksi / org…" />
                <button className="button button-ghost" type="submit">Cari</button>
              </form>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Waktu</th>
                    <th>Aksi</th>
                    <th>Organisasi</th>
                    <th>Actor</th>
                    <th>Target</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td>{formatDate(log.createdAt)}</td>
                      <td><strong>{log.action}</strong></td>
                      <td>{log.organization.name}</td>
                      <td>{log.actor?.email || "—"}</td>
                      <td>
                        {log.targetType}
                        <span className="admin-sub">{log.targetId || "—"}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {tab === "system" && system ? (
          <section className="admin-card">
            <div className="admin-card-head">
              <h2>Sistem & integrasi</h2>
              <Activity size={18} />
            </div>
            <div className="admin-stats">
              <article><strong>{system.activeSessions}</strong><span>Sesi aktif</span></article>
              <article><strong>{system.disabledUsers}</strong><span>User disabled</span></article>
              <article><strong>{system.failedRecordings}</strong><span>Recording gagal</span></article>
            </div>
            <ul className="admin-meta-list">
              <li>LiveKit: <strong>{system.livekitConfigured ? "OK" : "Belum lengkap"}</strong></li>
              <li>Email (Resend): <strong>{system.emailConfigured ? "OK" : "Belum"}</strong></li>
              <li>WhatsApp (Fonnte): <strong>{system.whatsappConfigured ? "OK" : "Belum"}</strong></li>
              <li>Cron secret: <strong>{system.cronConfigured ? "OK" : "Belum"}</strong></li>
              <li>Payment provider: <strong>{system.paymentProvider}</strong></li>
              <li>APP_URL: <strong>{system.appUrl || "—"}</strong></li>
              <li>Super Admin emails: <strong>{system.superAdminEmails.join(", ") || "—"}</strong></li>
            </ul>
            <form className="admin-system-form" onSubmit={saveSystem}>
              <label>
                Email dukungan
                <input
                  value={supportEmail}
                  onChange={(event) => setSupportEmail(event.target.value)}
                  placeholder="support@domainanda.com"
                />
              </label>
              <label className="admin-check">
                <input
                  type="checkbox"
                  checked={maintenanceMode}
                  onChange={(event) => setMaintenanceMode(event.target.checked)}
                />
                Mode maintenance
              </label>
              <button className="button" type="submit" disabled={busy}>
                Simpan pengaturan sistem
              </button>
            </form>
          </section>
        ) : null}

        {tab === "integrations" ? <AdminIntegrationsPanel /> : null}

        {tab === "branding" ? (
          <AdminBrandingPanel initialBranding={initialBranding} adminName={adminName} />
        ) : null}
      </div>
    </div>
  );
}
