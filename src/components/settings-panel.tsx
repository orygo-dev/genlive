"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  KeyRound,
  LoaderCircle,
  Plus,
  Trash2,
  UserRound,
} from "lucide-react";
import { roleLabel, type OrgRoleLabel } from "@/lib/organization-labels";

type SettingsPanelProps = {
  user: { id: string; name: string; email: string };
  organization: {
    id: string;
    name: string;
    slug: string;
    planCode: string;
    recordingRetentionDays: number | null;
    brandName: string | null;
    logoUrl: string | null;
    primaryColor: string | null;
    customDomain: string | null;
    ssoEnabled: boolean;
    ssoTenantHint: string | null;
  };
  currentRole: OrgRoleLabel;
  canManageOrg: boolean;
  canDeleteOrg: boolean;
  isOwner: boolean;
  membershipCount: number;
};

export function SettingsPanel({
  user,
  organization,
  currentRole,
  canManageOrg,
  canDeleteOrg,
  isOwner,
  membershipCount,
}: SettingsPanelProps) {
  const router = useRouter();
  const [profileName, setProfileName] = useState(user.name);
  const [orgName, setOrgName] = useState(organization.name);
  const [brandName, setBrandName] = useState(organization.brandName ?? "");
  const [logoUrl, setLogoUrl] = useState(organization.logoUrl ?? "");
  const [primaryColor, setPrimaryColor] = useState(
    organization.primaryColor ?? "#1f6feb",
  );
  const [customDomain, setCustomDomain] = useState(organization.customDomain ?? "");
  const [ssoEnabled, setSsoEnabled] = useState(organization.ssoEnabled);
  const [ssoTenantHint, setSsoTenantHint] = useState(
    organization.ssoTenantHint ?? "",
  );
  const [recordingRetentionDays, setRecordingRetentionDays] = useState(
    organization.recordingRetentionDays === null
      ? ""
      : String(organization.recordingRetentionDays),
  );
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [confirmDeleteName, setConfirmDeleteName] = useState("");
  const [confirmDeleteEmail, setConfirmDeleteEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy("profile");
    try {
      const response = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: profileName }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Profil belum dapat diperbarui.");
      }
      setMessage("Profil berhasil diperbarui.");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Profil belum dapat diperbarui.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy("password");
    try {
      const response = await fetch("/api/account/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Password belum dapat diubah.");
      }
      setCurrentPassword("");
      setNewPassword("");
      setMessage("Password berhasil diubah.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Password belum dapat diubah.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function updateRecordingRetention(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy("retention");
    try {
      const parsedValue =
        recordingRetentionDays.trim() === ""
          ? null
          : Number(recordingRetentionDays);
      const response = await fetch("/api/organizations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordingRetentionDays: parsedValue }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Retensi recording belum dapat disimpan.");
      }
      setMessage("Kebijakan retensi recording berhasil disimpan.");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Retensi recording belum dapat disimpan.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function updateOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy("org");
    try {
      const response = await fetch("/api/organizations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: orgName }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Workspace belum dapat diperbarui.");
      }
      setMessage("Nama workspace berhasil diperbarui.");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Workspace belum dapat diperbarui.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy("create");
    try {
      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newWorkspaceName }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Workspace belum dapat dibuat.");
      }
      setNewWorkspaceName("");
      router.push("/dashboard");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Workspace belum dapat dibuat.",
      );
      setBusy(null);
    }
  }

  async function updateWhiteLabel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy("whitelabel");
    try {
      const response = await fetch("/api/organizations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName: brandName.trim() || null,
          logoUrl: logoUrl.trim() || null,
          primaryColor: primaryColor.trim() || null,
          customDomain: customDomain.trim() || null,
          ssoEnabled,
          ssoTenantHint: ssoTenantHint.trim() || null,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Branding belum dapat disimpan.");
      }
      setMessage("Branding & SSO workspace berhasil disimpan.");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Branding belum dapat disimpan.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function deleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !window.confirm(
        "Menghapus akun akan menghapus profil dan session Anda. Lanjutkan?",
      )
    ) {
      return;
    }

    setError("");
    setMessage("");
    setBusy("account-delete");
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmEmail: confirmDeleteEmail }),
      });
      const payload = (await response.json()) as {
        error?: string;
        redirectTo?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Akun belum dapat dihapus.");
      }
      router.push(payload.redirectTo ?? "/");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Akun belum dapat dihapus.",
      );
      setBusy(null);
    }
  }

  async function leaveWorkspace() {
    if (
      !window.confirm(
        `Keluar dari workspace "${organization.name}"? Anda tetap dapat bergabung kembali jika diundang.`,
      )
    ) {
      return;
    }

    setError("");
    setMessage("");
    setBusy("leave");
    try {
      const response = await fetch("/api/organizations/leave", { method: "POST" });
      const payload = (await response.json()) as {
        error?: string;
        redirectTo?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Belum dapat keluar dari workspace.");
      }
      router.push(payload.redirectTo ?? "/dashboard");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Belum dapat keluar dari workspace.",
      );
      setBusy(null);
    }
  }

  async function deleteWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !window.confirm(
        "Menghapus workspace akan menghapus meeting, undangan, dan data terkait. Lanjutkan?",
      )
    ) {
      return;
    }

    setError("");
    setMessage("");
    setBusy("delete");
    try {
      const response = await fetch("/api/organizations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmName: confirmDeleteName }),
      });
      const payload = (await response.json()) as {
        error?: string;
        redirectTo?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Workspace belum dapat dihapus.");
      }
      router.push(payload.redirectTo ?? "/dashboard");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Workspace belum dapat dihapus.",
      );
      setBusy(null);
    }
  }

  return (
    <div className="settings-panel">
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {message ? <p className="settings-success">{message}</p> : null}

      <section className="settings-card">
        <header>
          <span><UserRound size={18} /></span>
          <div>
            <h2>Profil akun</h2>
            <p>Nama tampil di meeting dan undangan.</p>
          </div>
        </header>
        <form onSubmit={updateProfile} className="settings-form">
          <label>
            Nama
            <input
              value={profileName}
              onChange={(event) => setProfileName(event.target.value)}
              maxLength={80}
              required
            />
          </label>
          <label>
            Email
            <input value={user.email} disabled readOnly />
          </label>
          <button
            className="button button-primary"
            type="submit"
            disabled={busy === "profile"}
          >
            {busy === "profile" ? (
              <>
                <LoaderCircle className="spinner" size={16} /> Menyimpan...
              </>
            ) : (
              "Simpan profil"
            )}
          </button>
        </form>
      </section>

      <section className="settings-card">
        <header>
          <span><KeyRound size={18} /></span>
          <div>
            <h2>Password</h2>
            <p>Ganti password untuk mengamankan akun.</p>
          </div>
        </header>
        <form onSubmit={changePassword} className="settings-form">
          <label>
            Password saat ini
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <label>
            Password baru
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </label>
          <button
            className="button button-primary"
            type="submit"
            disabled={busy === "password"}
          >
            {busy === "password" ? (
              <>
                <LoaderCircle className="spinner" size={16} /> Menyimpan...
              </>
            ) : (
              "Ubah password"
            )}
          </button>
        </form>
      </section>

      <section className="settings-card">
        <header>
          <span><Building2 size={18} /></span>
          <div>
            <h2>Workspace aktif</h2>
            <p>
              Peran Anda: {roleLabel(currentRole)} · Plan {organization.planCode}
            </p>
          </div>
        </header>
        <form onSubmit={updateOrganization} className="settings-form">
          <label>
            Nama workspace
            <input
              value={orgName}
              onChange={(event) => setOrgName(event.target.value)}
              maxLength={100}
              required
              disabled={!canManageOrg}
            />
          </label>
          <label>
            Slug
            <input value={organization.slug} disabled readOnly />
          </label>
          {canManageOrg ? (
            <button
              className="button button-primary"
              type="submit"
              disabled={busy === "org"}
            >
              {busy === "org" ? (
                <>
                  <LoaderCircle className="spinner" size={16} /> Menyimpan...
                </>
              ) : (
                "Simpan workspace"
              )}
            </button>
          ) : (
            <p className="meeting-invite-hint">
              Hanya Owner/Admin yang dapat mengubah nama workspace.
            </p>
          )}
        </form>
      </section>

      {canManageOrg ? (
        <section className="settings-card">
          <header>
            <span><Building2 size={18} /></span>
            <div>
              <h2>Branding & SSO</h2>
              <p>White-label workspace dan batas domain Google Workspace.</p>
            </div>
          </header>
          <form onSubmit={updateWhiteLabel} className="settings-form">
            <label>
              Nama brand (opsional)
              <input
                value={brandName}
                onChange={(event) => setBrandName(event.target.value)}
                placeholder={organization.name}
                maxLength={100}
              />
            </label>
            <label>
              URL logo
              <input
                value={logoUrl}
                onChange={(event) => setLogoUrl(event.target.value)}
                placeholder="https://cdn.perusahaan.com/logo.png"
                maxLength={1000}
              />
            </label>
            <label>
              Warna utama
              <input
                type="color"
                value={primaryColor}
                onChange={(event) => setPrimaryColor(event.target.value)}
              />
            </label>
            <label>
              Domain kustom (informasi)
              <input
                value={customDomain}
                onChange={(event) => setCustomDomain(event.target.value)}
                placeholder="meet.perusahaan.com"
                maxLength={255}
              />
            </label>
            <p className="meeting-invite-hint">
              Domain kustom memerlukan CNAME DNS ke host GenMeet Anda. Fitur
              reverse proxy otomatis menyusul.
            </p>
            <label className="settings-checkbox">
              <input
                type="checkbox"
                checked={ssoEnabled}
                onChange={(event) => setSsoEnabled(event.target.checked)}
              />
              Aktifkan SSO Google Workspace (domain hint)
            </label>
            <label>
              Hosted domain hint
              <input
                value={ssoTenantHint}
                onChange={(event) => setSsoTenantHint(event.target.value)}
                placeholder="perusahaan.com"
                maxLength={255}
                disabled={!ssoEnabled}
              />
            </label>
            <p className="meeting-invite-hint">
              SAML/OIDC penuh menyusul; saat ini Google OAuth + domain hint.
            </p>
            <button
              className="button button-primary"
              type="submit"
              disabled={busy === "whitelabel"}
            >
              {busy === "whitelabel" ? (
                <>
                  <LoaderCircle className="spinner" size={16} /> Menyimpan...
                </>
              ) : (
                "Simpan branding"
              )}
            </button>
          </form>
        </section>
      ) : null}

      {canManageOrg ? (
        <section className="settings-card">
          <header>
            <span><Building2 size={18} /></span>
            <div>
              <h2>Kepatuhan & ekspor</h2>
              <p>Unduh log audit dan data metadata workspace.</p>
            </div>
          </header>
          <div className="settings-danger-actions">
            <div>
              <h3>Audit log (CSV)</h3>
              <p>Riwayat aksi penting di workspace ini.</p>
              <a
                className="button button-ghost"
                href="/api/organizations/audit-export"
              >
                Unduh audit log (CSV)
              </a>
            </div>
            {isOwner ? (
              <div>
                <h3>Ekspor data workspace (JSON)</h3>
                <p>Metadata meeting & anggota — tanpa file rekaman.</p>
                <a
                  className="button button-ghost"
                  href="/api/organizations/data-export"
                >
                  Unduh ekspor data
                </a>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {canManageOrg ? (
        <section className="settings-card">
          <header>
            <span><Building2 size={18} /></span>
            <div>
              <h2>Retensi recording</h2>
              <p>
                Hapus otomatis rekaman yang sudah selesai setelah jumlah hari
                tertentu. Kosongkan untuk menyimpan selamanya.
              </p>
            </div>
          </header>
          <form onSubmit={updateRecordingRetention} className="settings-form">
            <label>
              Simpan recording selama (hari)
              <select
                value={recordingRetentionDays}
                onChange={(event) => setRecordingRetentionDays(event.target.value)}
              >
                <option value="">Simpan selamanya</option>
                <option value="7">7 hari</option>
                <option value="30">30 hari</option>
                <option value="90">90 hari</option>
                <option value="365">365 hari</option>
              </select>
            </label>
            <button
              className="button button-primary"
              type="submit"
              disabled={busy === "retention"}
            >
              {busy === "retention" ? (
                <>
                  <LoaderCircle className="spinner" size={16} /> Menyimpan...
                </>
              ) : (
                "Simpan retensi"
              )}
            </button>
          </form>
        </section>
      ) : null}

      <section className="settings-card">
        <header>
          <span><Plus size={18} /></span>
          <div>
            <h2>Buat workspace baru</h2>
            <p>Anda akan menjadi Owner workspace baru.</p>
          </div>
        </header>
        <form onSubmit={createWorkspace} className="settings-form">
          <label>
            Nama workspace
            <input
              value={newWorkspaceName}
              onChange={(event) => setNewWorkspaceName(event.target.value)}
              placeholder="Contoh: Tim Produk"
              maxLength={100}
              required
            />
          </label>
          <button
            className="button button-ghost"
            type="submit"
            disabled={busy === "create"}
          >
            {busy === "create" ? (
              <>
                <LoaderCircle className="spinner" size={16} /> Membuat...
              </>
            ) : (
              "Buat workspace"
            )}
          </button>
        </form>
      </section>

      <section className="settings-card settings-danger-card">
        <header>
          <span><Trash2 size={18} /></span>
          <div>
            <h2>Zona bahaya</h2>
            <p>Tindakan di sini tidak dapat dibatalkan dengan mudah.</p>
          </div>
        </header>

        <div className="settings-danger-actions">
          <div>
            <h3>Keluar dari workspace</h3>
            <p>
              Anda keluar dari {organization.name}. Saat ini Anda punya{" "}
              {membershipCount} workspace.
            </p>
            <button
              type="button"
              className="button button-ghost settings-leave"
              onClick={() => void leaveWorkspace()}
              disabled={busy === "leave"}
            >
              {busy === "leave" ? "Memproses..." : "Keluar dari workspace"}
            </button>
          </div>

          {canDeleteOrg ? (
            <form onSubmit={deleteWorkspace} className="settings-form">
              <h3>Hapus workspace</h3>
              <p>
                Ketik <strong>{organization.name}</strong> untuk mengonfirmasi
                penghapusan permanen.
              </p>
              <label>
                Konfirmasi nama
                <input
                  value={confirmDeleteName}
                  onChange={(event) => setConfirmDeleteName(event.target.value)}
                  placeholder={organization.name}
                  required
                />
              </label>
              <button
                type="submit"
                className="button settings-delete"
                disabled={busy === "delete"}
              >
                {busy === "delete" ? "Menghapus..." : "Hapus workspace"}
              </button>
            </form>
          ) : null}

          <form onSubmit={deleteAccount} className="settings-form">
            <h3>Hapus akun</h3>
            <p>
              Ketik email Anda (<strong>{user.email}</strong>) untuk menghapus
              akun permanen. Workspace kosong akan ikut dihapus otomatis.
            </p>
            <label>
              Konfirmasi email
              <input
                type="email"
                value={confirmDeleteEmail}
                onChange={(event) => setConfirmDeleteEmail(event.target.value)}
                placeholder={user.email}
                required
              />
            </label>
            <button
              type="submit"
              className="button settings-delete"
              disabled={busy === "account-delete"}
            >
              {busy === "account-delete" ? "Menghapus..." : "Hapus akun"}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
