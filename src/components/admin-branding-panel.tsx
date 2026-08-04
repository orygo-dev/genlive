"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ImagePlus,
  LoaderCircle,
  Plus,
  Save,
  Shield,
  Trash2,
} from "lucide-react";
import {
  MOBILE_BANNER_RECOMMENDED,
  MOBILE_POPUP_RECOMMENDED,
  defaultMobilePopupAd,
  type MobileBannerSlide,
  type MobilePopupAd,
  type PlatformBranding,
} from "@/lib/platform-branding";

type AssetKind =
  | "logo"
  | "loginBackground"
  | "splashBackground"
  | "splashLogo";

const ASSET_FIELDS: Array<{
  kind: AssetKind;
  key: "logoUrl" | "loginBackgroundUrl" | "splashBackgroundUrl" | "splashLogoUrl";
  label: string;
  hint: string;
}> = [
  {
    kind: "logo",
    key: "logoUrl",
    label: "Logo aplikasi",
    hint: "Muncul di header, dashboard, dan auth (tanpa frame). Format: JPG/PNG/WEBP/GIF.",
  },
  {
    kind: "loginBackground",
    key: "loginBackgroundUrl",
    label: "Background halaman login",
    hint: "Gambar panel kiri pada halaman masuk/daftar. Disarankan landscape lebar.",
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

function createSlideId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `slide-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

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
  const [slides, setSlides] = useState<MobileBannerSlide[]>(
    initialBranding.mobileBannerSlides ?? [],
  );
  const [popupAd, setPopupAd] = useState<MobilePopupAd>(
    initialBranding.mobilePopupAd ?? defaultMobilePopupAd,
  );
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function patchBranding(body: Record<string, unknown>) {
    const response = await fetch("/api/admin/platform/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as {
      error?: string;
      branding?: PlatformBranding;
    };
    if (!response.ok || !payload.branding) {
      throw new Error(payload.error ?? "Pengaturan brand belum dapat disimpan.");
    }
    setBranding(payload.branding);
    setSlides(payload.branding.mobileBannerSlides ?? []);
    setPopupAd(payload.branding.mobilePopupAd ?? defaultMobilePopupAd);
    return payload.branding;
  }

  async function saveName(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy("name");
    try {
      await patchBranding({ appName });
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

  async function uploadFile(kind: string, file: File) {
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
    return uploadPayload.url;
  }

  async function uploadAsset(kind: AssetKind, file: File) {
    setError("");
    setMessage("");
    setBusy(kind);
    try {
      const url = await uploadFile(kind, file);
      const field =
        kind === "logo"
          ? "logoUrl"
          : kind === "loginBackground"
            ? "loginBackgroundUrl"
            : kind === "splashBackground"
              ? "splashBackgroundUrl"
              : "splashLogoUrl";
      await patchBranding({ [field]: url });
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
      await patchBranding({ [field]: null });
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

  async function saveSlides(next: MobileBannerSlide[]) {
    setError("");
    setMessage("");
    setBusy("slides");
    try {
      await patchBranding({ mobileBannerSlides: next });
      setMessage("Banner mobile disimpan.");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Banner mobile belum dapat disimpan.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function addSlideImage(file: File) {
    if (slides.length >= MOBILE_BANNER_RECOMMENDED.maxSlides) {
      setError(
        `Maksimal ${MOBILE_BANNER_RECOMMENDED.maxSlides} slide banner mobile.`,
      );
      return;
    }
    setError("");
    setMessage("");
    setBusy("add-slide");
    try {
      const url = await uploadFile("mobileBanner", file);
      const next = [
        ...slides,
        {
          id: createSlideId(),
          imageUrl: url,
          title: "",
          body: "",
          linkUrl: null,
          active: true,
        },
      ];
      setSlides(next);
      await patchBranding({ mobileBannerSlides: next });
      setMessage("Slide banner ditambahkan.");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Slide belum dapat diunggah.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function replaceSlideImage(slideId: string, file: File) {
    setError("");
    setMessage("");
    setBusy(`slide-img-${slideId}`);
    try {
      const url = await uploadFile("mobileBanner", file);
      const next = slides.map((slide) =>
        slide.id === slideId ? { ...slide, imageUrl: url } : slide,
      );
      setSlides(next);
      await patchBranding({ mobileBannerSlides: next });
      setMessage("Gambar slide diperbarui.");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Gambar slide belum dapat diganti.",
      );
    } finally {
      setBusy(null);
    }
  }

  function moveSlide(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= slides.length) return;
    const next = [...slides];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    setSlides(next);
  }

  function updateSlide(
    slideId: string,
    patch: Partial<Pick<MobileBannerSlide, "title" | "body" | "active">>,
  ) {
    setSlides((current) =>
      current.map((slide) =>
        slide.id === slideId ? { ...slide, ...patch } : slide,
      ),
    );
  }

  function removeSlide(slideId: string) {
    setSlides((current) => current.filter((slide) => slide.id !== slideId));
  }

  async function uploadPopupImage(file: File) {
    setError("");
    setMessage("");
    setBusy("popup-upload");
    try {
      const url = await uploadFile("mobilePopup", file);
      const next: MobilePopupAd = {
        ...popupAd,
        imageUrl: url,
        enabled: true,
      };
      setPopupAd(next);
      await patchBranding({ mobilePopupAd: next });
      setMessage("Gambar popup ads diunggah.");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Gambar popup belum dapat diunggah.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function savePopupAd() {
    setError("");
    setMessage("");
    setBusy("popup-save");
    try {
      await patchBranding({ mobilePopupAd: popupAd });
      setMessage("Popup ads disimpan.");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Popup ads belum dapat disimpan.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function clearPopupAd() {
    setError("");
    setMessage("");
    setBusy("popup-clear");
    try {
      const next: MobilePopupAd = {
        enabled: false,
        imageUrl: null,
        linkUrl: null,
        updatedAt: null,
      };
      setPopupAd(next);
      await patchBranding({ mobilePopupAd: next });
      setMessage("Popup ads dihapus.");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Popup ads belum dapat dihapus.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="admin-panel">
      <header className="admin-hero">
        <span className="admin-hero-icon">
          <Shield size={22} />
        </span>
        <div>
          <p>Super Admin · {adminName}</p>
          <h1>Pengaturan brand platform</h1>
          <p>
            Atur nama aplikasi, logo, background login, splash, popup ads, dan
            banner slide untuk aplikasi mobile.
          </p>
        </div>
      </header>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
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
              <>
                <LoaderCircle className="spinner" size={16} /> Menyimpan...
              </>
            ) : (
              <>
                <Save size={16} /> Simpan nama
              </>
            )}
          </button>
        </form>
      </section>

      <section id="popup-ads" className="settings-card">
        <header>
          <div>
            <h2>Popup ads (aplikasi mobile)</h2>
            <p>
              Tampil sekali setiap kali aplikasi dibuka (cold start), bukan saat
              refresh beranda. Gambar penuh tanpa frame.
            </p>
          </div>
        </header>

        <div className="admin-banner-size-hint" role="note">
          <strong>Ukuran upload yang disarankan</strong>
          <ul>
            <li>
              Resolusi ideal:{" "}
              <code>
                {MOBILE_POPUP_RECOMMENDED.width}×
                {MOBILE_POPUP_RECOMMENDED.height} px
              </code>{" "}
              (rasio {MOBILE_POPUP_RECOMMENDED.aspectLabel})
            </li>
            <li>
              Alternatif: <code>1080×1080 px</code> (persegi) · desain isi
              gambar sampai tepi (edge-to-edge)
            </li>
            <li>
              Format: JPG / PNG / WEBP · maksimal{" "}
              {MOBILE_POPUP_RECOMMENDED.maxBytesLabel}
            </li>
            <li>
              Hindari menambahkan bingkai/padding di file gambar — aplikasi
              menampilkan gambar utuh apa adanya
            </li>
          </ul>
        </div>

        <div className="admin-popup-ad-grid">
          <div className="admin-popup-ad-preview">
            {popupAd.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={popupAd.imageUrl} alt="Preview popup ads" />
            ) : (
              <p className="admin-muted">Belum ada gambar popup.</p>
            )}
          </div>
          <div className="admin-popup-ad-fields">
            <label className="admin-check">
              <input
                type="checkbox"
                checked={popupAd.enabled}
                disabled={!popupAd.imageUrl}
                onChange={(event) =>
                  setPopupAd((current) => ({
                    ...current,
                    enabled: event.target.checked,
                  }))
                }
              />
              Aktifkan popup saat aplikasi dibuka
            </label>
            <label>
              Tautan opsional (dibuka saat gambar diketuk)
              <input
                value={popupAd.linkUrl ?? ""}
                maxLength={1000}
                onChange={(event) =>
                  setPopupAd((current) => ({
                    ...current,
                    linkUrl: event.target.value,
                  }))
                }
                placeholder="https://…"
              />
            </label>
            <div className="admin-mobile-banner-item-actions">
              <label className="button button-ghost admin-upload">
                <ImagePlus size={14} />
                {popupAd.imageUrl ? "Ganti gambar" : "Unggah gambar"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  hidden
                  disabled={Boolean(busy)}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void uploadPopupImage(file);
                  }}
                />
              </label>
              {popupAd.imageUrl ? (
                <button
                  type="button"
                  className="button button-ghost"
                  disabled={Boolean(busy)}
                  onClick={() => void clearPopupAd()}
                >
                  <Trash2 size={14} /> Hapus
                </button>
              ) : null}
              <button
                type="button"
                className="button button-primary"
                disabled={busy === "popup-save"}
                onClick={() => void savePopupAd()}
              >
                {busy === "popup-save" ? (
                  <>
                    <LoaderCircle className="spinner" size={16} /> Menyimpan...
                  </>
                ) : (
                  <>
                    <Save size={16} /> Simpan popup ads
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
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
                    accept="image/png,image/jpeg,image/webp,image/gif"
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

      <section className="settings-card">
        <header>
          <div>
            <h2>Banner slide (aplikasi mobile)</h2>
            <p>
              Carousel di beranda aplikasi GenMeet. Ukuran tidak terlalu tinggi
              di layar HP — pakai rasio landscape lebar.
            </p>
          </div>
        </header>

        <div className="admin-banner-size-hint" role="note">
          <strong>Ukuran upload yang disarankan</strong>
          <ul>
            <li>
              Resolusi ideal:{" "}
              <code>
                {MOBILE_BANNER_RECOMMENDED.width}×
                {MOBILE_BANNER_RECOMMENDED.height} px
              </code>{" "}
              (rasio {MOBILE_BANNER_RECOMMENDED.aspectLabel})
            </li>
            <li>
              Alternatif aman: <code>1200×480 px</code> (rasio 2.5:1)
            </li>
            <li>
              Format: JPG / PNG / WEBP · maksimal{" "}
              {MOBILE_BANNER_RECOMMENDED.maxBytesLabel} per file
            </li>
            <li>
              Maksimal {MOBILE_BANNER_RECOMMENDED.maxSlides} slide · area teks
              aman di sisi kiri gambar
            </li>
            <li>
              Hindari gambar portrait atau terlalu tinggi — di HP tinggi banner
              dibatasi ~120–140 px
            </li>
          </ul>
        </div>

        <div className="admin-mobile-banner-list">
          {slides.length === 0 ? (
            <p className="admin-muted">
              Belum ada slide. Unggah gambar untuk menambah banner.
            </p>
          ) : (
            slides.map((slide, index) => (
              <article key={slide.id} className="admin-mobile-banner-item">
                <div className="admin-mobile-banner-preview">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={slide.imageUrl} alt={slide.title || `Slide ${index + 1}`} />
                </div>
                <div className="admin-mobile-banner-fields">
                  <label>
                    Judul (opsional)
                    <input
                      value={slide.title}
                      maxLength={80}
                      onChange={(event) =>
                        updateSlide(slide.id, { title: event.target.value })
                      }
                      placeholder="Contoh: Rapat lebih mudah"
                    />
                  </label>
                  <label>
                    Deskripsi singkat (opsional)
                    <input
                      value={slide.body}
                      maxLength={200}
                      onChange={(event) =>
                        updateSlide(slide.id, { body: event.target.value })
                      }
                      placeholder="Teks pendukung di bawah judul"
                    />
                  </label>
                  <label className="admin-check">
                    <input
                      type="checkbox"
                      checked={slide.active}
                      onChange={(event) =>
                        updateSlide(slide.id, { active: event.target.checked })
                      }
                    />
                    Tampilkan di aplikasi
                  </label>
                  <div className="admin-mobile-banner-item-actions">
                    <label className="button button-ghost admin-upload">
                      <ImagePlus size={14} />
                      Ganti gambar
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        hidden
                        disabled={Boolean(busy)}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          if (file) void replaceSlideImage(slide.id, file);
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="button button-ghost"
                      disabled={index === 0 || Boolean(busy)}
                      onClick={() => moveSlide(index, -1)}
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      className="button button-ghost"
                      disabled={index === slides.length - 1 || Boolean(busy)}
                      onClick={() => moveSlide(index, 1)}
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      type="button"
                      className="button button-ghost"
                      disabled={Boolean(busy)}
                      onClick={() => removeSlide(slide.id)}
                    >
                      <Trash2 size={14} /> Hapus
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>

        <div className="admin-mobile-banner-footer">
          <label className="button button-ghost admin-upload">
            <Plus size={16} />
            {busy === "add-slide" ? "Mengunggah..." : "Tambah slide"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              hidden
              disabled={
                Boolean(busy) ||
                slides.length >= MOBILE_BANNER_RECOMMENDED.maxSlides
              }
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void addSlideImage(file);
              }}
            />
          </label>
          <button
            type="button"
            className="button button-primary"
            disabled={busy === "slides"}
            onClick={() => void saveSlides(slides)}
          >
            {busy === "slides" ? (
              <>
                <LoaderCircle className="spinner" size={16} /> Menyimpan...
              </>
            ) : (
              <>
                <Save size={16} /> Simpan banner mobile
              </>
            )}
          </button>
        </div>
      </section>
    </div>
  );
}
