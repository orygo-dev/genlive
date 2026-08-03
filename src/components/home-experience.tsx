"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  LockKeyhole,
  Menu,
  Mic,
  MonitorUp,
  Plus,
  ShieldCheck,
  Users,
  Video,
  X,
} from "lucide-react";
import { normalizeRoomName } from "@/lib/meeting";
import { AppBrand } from "@/components/app-brand";
import type { PlatformBranding } from "@/lib/platform-branding";
import { DEFAULT_PLAN_CATALOG, formatIdr } from "@/lib/plans";

export function HomeExperience({
  branding,
  maintenanceMode = false,
}: {
  branding: PlatformBranding;
  maintenanceMode?: boolean;
}) {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const free = DEFAULT_PLAN_CATALOG.FREE;
  const pro = DEFAULT_PLAN_CATALOG.PRO;

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  async function startMeeting() {
    setMenuOpen(false);
    setError("");
    setIsStarting(true);

    try {
      const response = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Meeting instan", waitingRoom: false }),
      });
      const result = (await response.json()) as {
        error?: string;
        meeting?: { id: string; roomName: string };
      };

      if (response.status === 401 || response.status === 403) {
        router.push("/auth");
        return;
      }

      if (!response.ok || !result.meeting) {
        throw new Error(result.error ?? "Meeting belum dapat dibuat.");
      }

      router.push(`/dashboard/meetings/${result.meeting.id}`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Meeting belum dapat dibuat. Silakan masuk terlebih dahulu.",
      );
    } finally {
      setIsStarting(false);
    }
  }

  function joinMeeting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeRoomName(roomCode);

    if (normalized.length < 3) {
      setError("Masukkan kode meeting minimal 3 karakter.");
      return;
    }

    router.push(`/meeting/${normalized}`);
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <div className={`landing${menuOpen ? " landing-menu-open" : ""}`}>
      {maintenanceMode ? (
        <div className="landing-maintenance" role="status">
          Platform sedang dalam mode maintenance. Layanan pengguna sementara
          dibatasi. Super Admin tetap dapat masuk ke /admin.
        </div>
      ) : null}

      <div className="landing-top">
        <header className="landing-header">
          <AppBrand branding={branding} className="landing-brand-nav" markSize={26} />

          <div className="landing-header-actions">
            <Link className="landing-nav-cta landing-header-signup" href="/auth">
              Daftar gratis
            </Link>
            <button
              type="button"
              className="landing-menu-toggle"
              aria-expanded={menuOpen}
              aria-controls="landing-mobile-nav"
              aria-label={menuOpen ? "Tutup menu" : "Buka menu"}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>

          <nav className="landing-nav landing-nav-desktop" aria-label="Navigasi utama">
            <a href="#fitur">Produk</a>
            <a href="#harga">Harga</a>
            <Link href="/auth">Masuk</Link>
            <Link className="landing-nav-ghost" href="/auth">
              Hubungi kami
            </Link>
            <Link className="landing-nav-cta" href="/auth">
              Daftar gratis
            </Link>
          </nav>
        </header>

        {menuOpen ? (
          <button
            type="button"
            className="landing-nav-backdrop"
            aria-label="Tutup menu"
            onClick={closeMenu}
          />
        ) : null}

        <nav
          id="landing-mobile-nav"
          className={`landing-nav-drawer${menuOpen ? " is-open" : ""}`}
          aria-label="Menu mobile"
          aria-hidden={!menuOpen}
        >
          <a href="#fitur" onClick={closeMenu}>
            Produk
          </a>
          <a href="#harga" onClick={closeMenu}>
            Harga
          </a>
          <a href="#alur" onClick={closeMenu}>
            Cara kerja
          </a>
          <Link href="/auth" onClick={closeMenu}>
            Masuk
          </Link>
          <Link href="/auth" className="landing-nav-drawer-cta" onClick={closeMenu}>
            Daftar gratis
          </Link>
          <button
            type="button"
            className="landing-nav-drawer-quick"
            onClick={() => void startMeeting()}
            disabled={isStarting}
          >
            <Plus size={16} /> {isStarting ? "Menyiapkan..." : "Meeting cepat"}
          </button>
        </nav>

        <section className="landing-hero" aria-labelledby="landing-hero-title">
          <h1 id="landing-hero-title">
            Temukan apa yang mungkin saat tim terhubung
          </h1>
          <p className="landing-hero-lead">
            Platform meeting video untuk bisnis — workspace, undangan, recording,
            dan billing dalam satu tempat.
          </p>

          <div className="landing-zoom-actions" aria-label="Gabung atau mulai meeting">
            <form className="landing-zoom-join" onSubmit={joinMeeting} noValidate>
              <label className="landing-join-field">
                <span className="sr-only">Kode meeting</span>
                <input
                  value={roomCode}
                  onChange={(event) => {
                    setRoomCode(event.target.value);
                    setError("");
                  }}
                  placeholder="Masukkan kode meeting"
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "join-error-hero" : undefined}
                />
              </label>
              <button className="landing-btn landing-btn-dark" type="submit">
                Gabung meeting
              </button>
            </form>
            <div className="landing-zoom-host">
              <Link className="landing-btn landing-btn-light" href="/auth">
                Mulai meeting
                <ArrowRight size={18} />
              </Link>
              <button
                type="button"
                className="landing-btn landing-btn-ghost"
                onClick={() => void startMeeting()}
                disabled={isStarting}
              >
                <Plus size={16} /> {isStarting ? "Menyiapkan..." : "Meeting cepat"}
              </button>
            </div>
            {error ? (
              <p className="form-error" id="join-error-hero" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <div className="landing-hero-actions landing-hero-actions-secondary">
            <Link className="landing-btn landing-btn-dark" href="/auth">
              Mulai gratis
              <ArrowRight size={18} />
            </Link>
            <a className="landing-btn landing-btn-light" href="#harga">
              Lihat paket
            </a>
          </div>
        </section>

        <section className="landing-showcase" aria-label="Pratinjau produk">
          <article className="landing-show-card landing-show-meetings">
            <div className="landing-show-label">Meetings</div>
            <div className="landing-show-stage">
              <div className="landing-show-bar">
                <span className="landing-show-live" />
                Rapat produk
                <span>12:48</span>
              </div>
              <div className="landing-show-grid">
                <div className="landing-show-tile landing-show-tile-main">
                  <span className="landing-show-avatar">AN</span>
                  <span>Anisa · Host</span>
                </div>
                <div className="landing-show-tile">
                  <span className="landing-show-avatar landing-show-avatar-b">RK</span>
                  <span>Raka</span>
                </div>
                <div className="landing-show-tile">
                  <span className="landing-show-avatar landing-show-avatar-c">MS</span>
                  <span>Maya</span>
                </div>
              </div>
              <div className="landing-show-dock">
                <span><Mic size={15} /></span>
                <span><Video size={15} /></span>
                <span><MonitorUp size={15} /></span>
                <span className="landing-show-end">Akhiri</span>
              </div>
            </div>
          </article>

          <article className="landing-show-card landing-show-workspace">
            <div className="landing-show-label">Workspace</div>
            <ul className="landing-show-list">
              <li><strong>Acme Indonesia</strong><span>Owner</span></li>
              <li><strong>Tim Produk</strong><span>Admin</span></li>
              <li><strong>Customer Success</strong><span>Member</span></li>
            </ul>
            <p>Undang anggota, atur peran, kelola meeting dari satu dashboard.</p>
          </article>

          <article className="landing-show-card landing-show-join">
            <div className="landing-show-label">Gabung cepat</div>
            <p>Masukkan kode meeting dan langsung bergabung dari browser.</p>
            <form className="landing-join" onSubmit={joinMeeting} noValidate>
              <label className="landing-join-field">
                <span className="sr-only">Kode meeting</span>
                <input
                  value={roomCode}
                  onChange={(event) => {
                    setRoomCode(event.target.value);
                    setError("");
                  }}
                  placeholder="Kode meeting"
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "join-error" : undefined}
                />
              </label>
              <button className="landing-btn landing-btn-dark" type="submit">
                Gabung
              </button>
            </form>
            {error ? (
              <p className="form-error" id="join-error" role="alert">
                {error}
              </p>
            ) : null}
            <button
              className="landing-show-quick"
              type="button"
              onClick={() => void startMeeting()}
              disabled={isStarting}
            >
              <Plus size={16} /> {isStarting ? "Menyiapkan..." : "Meeting cepat"}
            </button>
          </article>
        </section>
      </div>

      <main>
        <section className="landing-section" id="fitur">
          <div className="landing-section-head landing-section-head-center">
            <h2>Satu platform untuk meeting bisnis</h2>
            <p>
              Dari ruang instan hingga kontrol workspace — tanpa aplikasi ekstra.
            </p>
          </div>
          <ul className="landing-feature-grid">
            <li>
              <Video size={22} />
              <strong>Video & audio adaptif</strong>
              <p>Kualitas menyesuaikan jaringan agar percakapan tetap stabil.</p>
            </li>
            <li>
              <MonitorUp size={22} />
              <strong>Berbagi layar & chat</strong>
              <p>Presentasi dan diskusi dalam satu ruang yang fokus.</p>
            </li>
            <li>
              <Users size={22} />
              <strong>Workspace & undangan</strong>
              <p>Kelola anggota, undang lewat email atau WhatsApp.</p>
            </li>
            <li>
              <ShieldCheck size={22} />
              <strong>Kontrol akses</strong>
              <p>Waiting room, password, dan token aman dari server.</p>
            </li>
            <li>
              <LockKeyhole size={22} />
              <strong>Recording & billing</strong>
              <p>Kuota plan Free/Pro, order otomatis, dan rekaman cloud.</p>
            </li>
          </ul>
        </section>

        <section className="landing-section landing-section-muted" id="alur">
          <div className="landing-section-head landing-section-head-center">
            <h2>Siap dipakai dalam tiga langkah</h2>
            <p>Onboarding singkat, hasil langsung terasa di tim Anda.</p>
          </div>
          <ol className="landing-steps">
            <li>
              <span>01</span>
              <strong>Buat workspace</strong>
              <p>Daftar dan bentuk organisasi untuk tim Anda.</p>
            </li>
            <li>
              <span>02</span>
              <strong>Undang anggota</strong>
              <p>Kirim undangan, atur peran Owner, Admin, atau Member.</p>
            </li>
            <li>
              <span>03</span>
              <strong>Mulai meeting</strong>
              <p>Jadwalkan atau masuk ruang langsung dari dashboard.</p>
            </li>
          </ol>
        </section>

        <section className="landing-section" id="harga">
          <div className="landing-section-head landing-section-head-center">
            <h2>Pilih paket yang sesuai</h2>
            <p>Mulai gratis, naik ke Pro saat kebutuhan tim meningkat.</p>
          </div>
          <div className="landing-pricing">
            <article className="landing-price">
              <h3>{free.name}</h3>
              <p className="landing-price-amount">{formatIdr(free.priceIdr)}</p>
              <p className="landing-price-note">Untuk mulai dan uji coba tim kecil</p>
              <ul>
                {free.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <Link className="landing-btn landing-btn-outline" href="/auth">
                Pakai gratis
              </Link>
            </article>
            <article className="landing-price landing-price-featured">
              <h3>{pro.name}</h3>
              <p className="landing-price-amount">
                {formatIdr(pro.priceIdr)}
                <span>/ {pro.billingPeriodDays} hari</span>
              </p>
              <p className="landing-price-note">Untuk operasional meeting yang lebih intens</p>
              <ul>
                {pro.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <Link className="landing-btn landing-btn-dark" href="/auth">
                Upgrade Pro
              </Link>
            </article>
          </div>
        </section>

        <section className="landing-closing">
          <h2>Siap menghubungkan tim Anda?</h2>
          <p>Daftar sekarang dan undang anggota dalam hitungan menit.</p>
          <div className="landing-hero-actions">
            <Link className="landing-btn landing-btn-light" href="/auth">
              Daftar gratis
              <ArrowRight size={18} />
            </Link>
            <Link className="landing-btn landing-btn-ghost" href="/auth">
              Masuk
            </Link>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <AppBrand branding={branding} className="landing-brand-nav" markSize={22} />
        <nav className="landing-footer-links" aria-label="Dokumen legal">
          <Link href="/terms">Syarat & Ketentuan</Link>
          <Link href="/privacy">Kebijakan Privasi</Link>
          <Link href="/cookies">Cookie</Link>
          <Link href="/dpa">DPA</Link>
        </nav>
        <span>© {new Date().getFullYear()}</span>
      </footer>
    </div>
  );
}
