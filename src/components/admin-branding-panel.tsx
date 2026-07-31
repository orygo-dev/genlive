"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ImagePlus,
  LoaderCircle,
  Save,
  Shield,
  Trash2,
} from "lucide-react";
import type { PlatformBranding } from "@/lib/platform-branding";

type AssetKind =
  | "logo"
  | "loginBackground"
  | "splashBackground"
  | "splashLogo";

const ASSET_FIELDS: Array<{
  kind: AssetKind;
  key: keyof PlatformBranding;
  label: string;
  hint: string;
}> = [
  {
    kind: "logo",
    key: "logoUrl",
    label: "Logo aplikasi",
    hint: "Muncul di header, dashboard, dan auth (tanpa frame).",
  },
  {
    kind: "loginBackground",
    key: "loginBackgroundUrl",
    label: "Background halaman login",
    hint: "Gambar panel kiri pada halaman masuk/daftar.",
  },
  {
    kind: "splashBackground",
    key: "splashBackgroundUrl",
    label: "Background splash screen",
    hint: "Latar layar splash saat aplikasi dibuka.",
  },
  {
    kind: "splashLogo",
    key: "splashLogoUrl",
    label: "Logo splash screen",
    hint: "Logo besar di tengah splash. Kosong = pakai logo aplikasi.",
  },
];

export function AdminBrandingPanel({
  initialBranding,
  adminName,
}: {
  initialBranding: PlatformBranding;
  adminName: string;
}) {
  const router = useRouter();
  const [branding, setBranding] = useState(initialBranding);
  const [appName, setAppName] = useState(initialBranding.appName);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function saveName(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy("name");
    try {
      const response = await fetch("/api/admin/platform/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appName }),
      });
      const payload = (await response.json()) as {
        error?: string;
        branding?: PlatformBranding;
      };
      if (!response.ok || !payload.branding) {
        throw new Error(payload.error ?? "Nama aplikasi belum dapat disimpan.");
      }
      setBranding(payload.branding);
      setMessage("Nama aplikasi disimpan.");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nama aplikasi belum dapat disimpan.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function uploadAsset(kind: AssetKind, file: File) {
    setError("");
    setMessage("");
    setBusy(kind);
    try {
      const body = new FormData();
      body.set("kind", kind);
      body.set("file", file);
      const uploadResponse = await fetch("/api/admin/platform/assets", {
        method: "POST",
        body,
      });
      const uploadPayload = (await uploadResponse.json()) as {
        error?: string;
        url?: string;
      };
      if (!uploadResponse.ok || !uploadPayload.url) {
        throw new Error(uploadPayload.error ?? "Upload gagal.");
      }

      const field =
        kind === "logo"
          ? "logoUrl"
          : kind === "loginBackground"
            ? "loginBackgroundUrl"
            : kind === "splashBackground"
              ? "splashBackgroundUrl"
              : "splashLogoUrl";

      const response = await fetch("/api/admin/platform/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: uploadPayload.url }),
      });
      const payload = (await response.json()) as {
        error?: string;
        branding?: PlatformBranding;
      };
      if (!response.ok || !payload.branding) {
        throw new Error(payload.error ?? "Aset belum dapat disimpan.");
      }
      setBranding(payload.branding);
      setMessage("Aset brand berhasil diperbarui.");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Aset belum dapat diunggah.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function clearAsset(kind: AssetKind) {
    setError("");
    setMessage("");
    setBusy(`clear-${kind}`);
    const field =
      kind === "logo"
        ? "logoUrl"
        : kind === "loginBackground"
          ? "loginBackgroundUrl"
          : kind === "splashBackground"
            ? "splashBackgroundUrl"
            : "splashLogoUrl";
    try {
      const response = await fetch("/api/admin/platform/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: null }),
      });
      const payload = (await response.json()) as {
        error?: string;
        branding?: PlatformBranding;
      };
      if (!response.ok || !payload.branding) {
        throw new Error(payload.error ?? "Aset belum dapat dihapus.");
      }
      setBranding(payload.branding);
      setMessage("Aset brand dihapus.");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Aset belum dapat dihapus.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="admin-panel">
      <header className="admin-hero">
        <span className="admin-hero-icon"><Shield size={22} /></span>
        <div>
          <p>Super Admin · {adminName}</p>
          <h1>Pengaturan brand platform</h1>
          <p>
            Atur nama aplikasi, logo, background login, dan splash screen untuk
            seluruh GenMeet.
          </p>
        </div>
      </header>

      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {message ? <p className="settings-success">{message}</p> : null}

      <section className="settings-card">
        <header>
          <div>
            <h2>Nama aplikasi</h2>
            <p>Ditampilkan di title, header, dan splash.</p>
          </div>
        </header>
        <form className="settings-form" onSubmit={saveName}>
          <label>
            Nama
            <input
              value={appName}
              onChange={(event) => setAppName(event.target.value)}
              maxLength={80}
              required
            />
          </label>
          <button
            className="button button-primary"
            type="submit"
            disabled={busy === "name"}
          >
            {busy === "name" ? (
              <><LoaderCircle className="spinner" size={16} /> Menyimpan...</>
            ) : (
              <><Save size={16} /> Simpan nama</>
            )}
          </button>
        </form>
      </section>

      {ASSET_FIELDS.map((asset) => {
        const current = branding[asset.key];
        return (
          <section key={asset.kind} className="settings-card">
            <header>
              <div>
                <h2>{asset.label}</h2>
                <p>{asset.hint}</p>
              </div>
            </header>
            <div className="admin-asset-row">
              <div className="admin-asset-preview">
                {typeof current === "string" && current ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={current} alt={asset.label} />
                ) : (
                  <span>Belum diunggah</span>
                )}
              </div>
              <div className="admin-asset-actions">
                <label className="button button-ghost admin-upload">
                  <ImagePlus size={16} />
                  {busy === asset.kind ? "Mengunggah..." : "Unggah gambar"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                    hidden
                    disabled={Boolean(busy)}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) void uploadAsset(asset.kind, file);
                    }}
                  />
                </label>
                {typeof current === "string" && current ? (
                  <button
                    type="button"
                    className="button button-ghost"
                    disabled={Boolean(busy)}
                    onClick={() => void clearAsset(asset.kind)}
                  >
                    <Trash2 size={16} /> Hapus
                  </button>
                ) : null}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
