"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  LockKeyhole,
  MonitorUp,
  Plus,
  ShieldCheck,
  Users,
  Video,
} from "lucide-react";
import { createRoomName, normalizeRoomName } from "@/lib/meeting";
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
  const free = DEFAULT_PLAN_CATALOG.FREE;
  const pro = DEFAULT_PLAN_CATALOG.PRO;

  function startMeeting() {
    router.push(`/meeting/${createRoomName()}`);
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

  return (
    <div className="landing">
      <div className="landing-atmosphere" aria-hidden="true" />

      {maintenanceMode ? (
        <div className="landing-maintenance" role="status">
          Platform sedang dalam mode maintenance. Layanan pengguna sementara
          dibatasi. Super Admin tetap dapat masuk ke /admin.
        </div>
      ) : null}
      <header className="landing-header">
        <AppBrand branding={branding} className="landing-brand-nav" markSize={18} />
        <nav className="landing-nav" aria-label="Navigasi utama">
          <a href="#fitur">Fitur</a>
          <a href="#harga">Harga</a>
          <Link href="/auth">Masuk</Link>
          <Link className="button button-primary landing-nav-cta" href="/auth">
            Mulai gratis
          </Link>
        </nav>
      </header>

      <main>
        <section className="landing-hero" aria-labelledby="landing-brand-title">
          <div className="landing-hero-copy">
            <p className="landing-brand-title" id="landing-brand-title">
              {branding.appName}
            </p>
            <h1>Meeting video yang siap dipakai bisnis.</h1>
            <p className="landing-hero-lead">
              Workspace, undangan, recording, dan billing — dalam satu platform
              yang langsung jalan dari browser.
            </p>

            <div className="landing-hero-actions">
              <Link className="button button-primary button-large" href="/auth">
                Mulai gratis
                <ArrowRight size={18} />
              </Link>
              <button
                className="button button-ghost button-large"
                type="button"
                onClick={startMeeting}
              >
                <Plus size={18} />
                Meeting cepat
              </button>
            </div>

            <form className="landing-join" onSubmit={joinMeeting} noValidate>
              <label className="landing-join-field">
                <span className="sr-only">Kode meeting</span>
                <Video size={17} aria-hidden="true" />
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
              <button className="button button-primary" type="submit">
                Gabung
              </button>
            </form>
            {error ? (
              <p className="form-error" id="join-error" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <div
            className="landing-hero-stage"
            aria-label={`Pratinjau ruang meeting ${branding.appName}`}
          >
            <div className="landing-stage-frame">
              <div className="landing-stage-bar">
                <span className="landing-stage-live" />
                <span>Rapat produk</span>
                <span className="landing-stage-time">12:48</span>
              </div>
              <div className="landing-stage-grid">
                <article className="landing-stage-tile landing-stage-tile-main">
                  <span className="landing-stage-avatar landing-stage-avatar-a">AN</span>
                  <span>Anisa · Host</span>
                </article>
                <article className="landing-stage-tile">
                  <span className="landing-stage-avatar landing-stage-avatar-b">RK</span>
                  <span>Raka</span>
                </article>
                <article className="landing-stage-tile">
                  <span className="landing-stage-avatar landing-stage-avatar-c">MS</span>
                  <span>Maya</span>
                </article>
              </div>
              <div className="landing-stage-dock">
                <span><Video size={16} /></span>
                <span><MonitorUp size={16} /></span>
                <span><Users size={16} /></span>
                <span className="landing-stage-end">Akhiri</span>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-section" id="fitur">
          <div className="landing-section-head">
            <h2>Semua yang dibutuhkan meeting bisnis</h2>
            <p>
              Dari ruang instan hingga kontrol workspace — tanpa aplikasi ekstra.
            </p>
          </div>
          <ul className="landing-feature-list">
            <li>
              <Video size={22} />
              <div>
                <strong>Video & audio adaptif</strong>
                <p>Kualitas menyesuaikan jaringan agar percakapan tetap stabil.</p>
              </div>
            </li>
            <li>
              <MonitorUp size={22} />
              <div>
                <strong>Berbagi layar & chat</strong>
                <p>Presentasi dan diskusi dalam satu ruang yang fokus.</p>
              </div>
            </li>
            <li>
              <Users size={22} />
              <div>
                <strong>Workspace & undangan</strong>
                <p>Kelola anggota, undang lewat email atau WhatsApp, atur peran.</p>
              </div>
            </li>
            <li>
              <ShieldCheck size={22} />
              <div>
                <strong>Kontrol akses</strong>
                <p>Waiting room, password, dan token aman dari server.</p>
              </div>
            </li>
            <li>
              <LockKeyhole size={22} />
              <div>
                <strong>Recording & billing</strong>
                <p>Kuota plan Free/Pro, order otomatis, dan rekaman cloud.</p>
              </div>
            </li>
          </ul>
        </section>

        <section className="landing-section landing-section-muted" id="alur">
          <div className="landing-section-head">
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
          <div className="landing-section-head">
            <h2>Harga yang jelas untuk bertumbuh</h2>
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
              <Link className="button button-ghost button-full" href="/auth">
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
              <Link className="button button-primary button-full" href="/auth">
                Upgrade Pro
              </Link>
            </article>
          </div>
        </section>

        <section className="landing-closing">
          <p className="landing-closing-brand">{branding.appName}</p>
          <h2>Bawa meeting bisnis Anda ke satu tempat.</h2>
          <p>Daftar sekarang dan undang tim dalam hitungan menit.</p>
          <div className="landing-hero-actions">
            <Link className="button button-primary button-large" href="/auth">
              Mulai gratis
              <ArrowRight size={18} />
            </Link>
            <Link className="button button-ghost button-large" href="/auth">
              Masuk
            </Link>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <AppBrand branding={branding} className="landing-brand-nav" markSize={16} />
        <p>Platform meeting untuk tim yang serius tumbuh.</p>
        <nav className="landing-footer-links" aria-label="Dokumen legal">
          <Link href="/terms">Syarat & Ketentuan</Link>
          <Link href="/privacy">Kebijakan Privasi</Link>
          <Link href="/cookies">Cookie</Link>
        </nav>
        <span>© {new Date().getFullYear()} {branding.appName}</span>
      </footer>
    </div>
  );
}
