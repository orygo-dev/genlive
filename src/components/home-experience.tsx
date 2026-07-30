"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  Check,
  LockKeyhole,
  MessageSquareText,
  MonitorUp,
  Plus,
  Sparkles,
  Video,
} from "lucide-react";
import { createRoomName, normalizeRoomName } from "@/lib/meeting";
import { AppBrand } from "@/components/app-brand";
import type { PlatformBranding } from "@/lib/platform-branding";

const benefits = [
  "Video HD adaptif",
  "Berbagi layar",
  "Chat real-time",
  "Akses terenkripsi",
];

export function HomeExperience({ branding }: { branding: PlatformBranding }) {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");

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
    <div className="site-shell">
      <header className="site-header">
        <AppBrand branding={branding} />
        <nav className="header-nav" aria-label="Navigasi utama">
          <a href="#fitur">Fitur</a>
          <a href="#keamanan">Keamanan</a>
          <Link className="header-login" href="/auth">Masuk</Link>
          <button className="button button-primary" type="button" onClick={startMeeting}>
            Mulai meeting
          </button>
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <Sparkles size={15} />
              Ruang kolaborasi untuk tim modern
            </div>
            <h1>Pertemuan yang terasa dekat, di mana pun berada.</h1>
            <p className="hero-lead">
              Mulai percakapan video berkualitas tinggi dalam hitungan detik.
              Tanpa instalasi, tanpa kerumitan.
            </p>

            <div className="hero-actions">
              <button className="button button-primary button-large" onClick={startMeeting}>
                <Plus size={19} />
                Meeting baru
              </button>
              <form className="join-form" onSubmit={joinMeeting} noValidate>
                <label className="join-input-wrap">
                  <span className="sr-only">Kode meeting</span>
                  <Video size={18} aria-hidden="true" />
                  <input
                    value={roomCode}
                    onChange={(event) => {
                      setRoomCode(event.target.value);
                      setError("");
                    }}
                    placeholder="Masukkan kode meeting"
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? "join-error" : undefined}
                  />
                </label>
                <button className="join-submit" type="submit" aria-label="Gabung meeting">
                  Gabung <ArrowRight size={17} />
                </button>
              </form>
            </div>
            {error && (
              <p className="form-error" id="join-error" role="alert">
                {error}
              </p>
            )}

            <ul className="benefit-list" aria-label={`Keunggulan ${branding.appName}`}>
              {benefits.map((benefit) => (
                <li key={benefit}>
                  <Check size={15} /> {benefit}
                </li>
              ))}
            </ul>
          </div>

          <div className="hero-visual" aria-label={`Pratinjau ruang meeting ${branding.appName}`}>
            <div className="meeting-preview">
              <div className="preview-topbar">
                <div>
                  <span className="live-dot" />
                  Design weekly
                </div>
                <span>12:48</span>
              </div>
              <div className="participant-grid">
                <div className="participant participant-main">
                  <div className="avatar avatar-coral">AN</div>
                  <span className="participant-name">Anisa</span>
                </div>
                <div className="participant">
                  <div className="avatar avatar-blue">RK</div>
                  <span className="participant-name">Raka</span>
                </div>
                <div className="participant participant-accent">
                  <div className="avatar avatar-green">MS</div>
                  <span className="participant-name">Maya</span>
                </div>
              </div>
              <div className="preview-controls">
                <span><Video size={17} /></span>
                <span><MonitorUp size={17} /></span>
                <span><MessageSquareText size={17} /></span>
                <span className="hangup">Tutup</span>
              </div>
            </div>
            <div className="floating-note">
              <span className="note-icon"><CalendarDays size={18} /></span>
              <span><strong>Meeting berikutnya</strong>Product sync · 14.00</span>
            </div>
          </div>
        </section>

        <section className="trust-strip" id="fitur">
          <p>Dirancang agar setiap pertemuan berjalan lancar</p>
          <div className="feature-row">
            <article>
              <span><Video size={20} /></span>
              <div><strong>Video jernih</strong><p>Kualitas adaptif pada setiap jaringan.</p></div>
            </article>
            <article>
              <span><MonitorUp size={20} /></span>
              <div><strong>Berbagi lebih mudah</strong><p>Presentasikan layar tanpa jeda.</p></div>
            </article>
            <article id="keamanan">
              <span><LockKeyhole size={20} /></span>
              <div><strong>Aman sejak awal</strong><p>Token akses dibuat aman di server.</p></div>
            </article>
          </div>
        </section>
      </main>

      <footer>
        <AppBrand branding={branding} className="brand brand-small" markSize={16} />
        <p>Komunikasi yang lebih manusiawi.</p>
        <span>© {new Date().getFullYear()} {branding.appName}</span>
      </footer>
    </div>
  );
}
