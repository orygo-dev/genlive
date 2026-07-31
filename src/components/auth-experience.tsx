"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
} from "lucide-react";
import { AppBrand } from "@/components/app-brand";
import type { PlatformBranding } from "@/lib/platform-branding";

type AuthMode = "login" | "register";

function safeNextPath(nextPath?: string) {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/dashboard";
  }

  return nextPath;
}

export function AuthExperience({
  nextPath,
  branding,
  oauthError,
}: {
  nextPath?: string;
  branding: PlatformBranding;
  oauthError?: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [googleConfigured, setGoogleConfigured] = useState(false);
  const [error, setError] = useState(oauthError ?? "");
  const destination = safeNextPath(nextPath);

  useEffect(() => {
    void fetch("/api/auth/google/status")
      .then((response) => response.json())
      .then((payload: { configured?: boolean }) => {
        setGoogleConfigured(Boolean(payload.configured));
      })
      .catch(() => setGoogleConfigured(false));
  }, []);

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError("");
    setShowPassword(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const payload =
      mode === "register"
        ? {
            name: formData.get("name"),
            organizationName: formData.get("organizationName"),
            email: formData.get("email"),
            password: formData.get("password"),
          }
        : {
            email: formData.get("email"),
            password: formData.get("password"),
          };

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        error?: string;
        user?: { isSuperAdmin?: boolean };
      };

      if (!response.ok) {
        throw new Error(result.error ?? "Permintaan tidak dapat diproses.");
      }

      let target = destination;
      if (mode === "login" && result.user?.isSuperAdmin) {
        if (!nextPath || nextPath === "/dashboard") {
          target = "/admin";
        } else {
          target = destination;
        }
      }

      router.replace(target);
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Terjadi kesalahan. Silakan coba lagi.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section
        className={[
          "auth-aside",
          branding.loginBackgroundUrl ? "has-image" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={
          branding.loginBackgroundUrl
            ? { backgroundImage: `url(${branding.loginBackgroundUrl})` }
            : undefined
        }
      >
        <AppBrand branding={branding} className="brand auth-brand" />
        <div className="auth-aside-copy">
          <span className="auth-overline">Kolaborasi yang lebih dekat</span>
          <h1>Satu tempat untuk semua percakapan penting tim Anda.</h1>
          <p>
            Meeting berkualitas tinggi, ruang kerja yang tertata, dan keamanan
            yang dirancang sejak awal.
          </p>
          <ul>
            <li><Check size={16} /> Meeting instan langsung dari browser</li>
            <li><Check size={16} /> Workspace terpisah untuk setiap organisasi</li>
            <li><Check size={16} /> Session aman dengan cookie terenkripsi</li>
          </ul>
        </div>
        <p className="auth-aside-foot">Didukung oleh infrastruktur LiveKit</p>
      </section>

      <section className="auth-panel">
        <div className="auth-box">
          <div className="auth-tabs" role="tablist" aria-label="Pilih autentikasi">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "login"}
              onClick={() => changeMode("login")}
            >
              Masuk
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "register"}
              onClick={() => changeMode("register")}
            >
              Buat akun
            </button>
          </div>

          <div className="auth-heading">
            <span className="auth-lock"><LockKeyhole size={20} /></span>
            <h2>
              {mode === "login" ? "Selamat datang kembali" : "Buat akun baru"}
            </h2>
            <p>
              {mode === "login"
                ? "Masuk untuk mengelola meeting dan workspace Anda."
                : "Buat akun dan workspace pertama Anda."}
            </p>
          </div>

          <form className="auth-form" onSubmit={submit} noValidate>
            {mode === "register" && (
              <>
                <label>
                  Nama lengkap
                  <input name="name" autoComplete="name" placeholder="Anisa Putri" />
                </label>
                <label>
                  Nama organisasi
                  <input
                    name="organizationName"
                    autoComplete="organization"
                    placeholder="Acme Indonesia"
                  />
                </label>
              </>
            )}
            <label>
              Email
              <input
                name="email"
                type="email"
                autoComplete="email"
                placeholder="nama@perusahaan.com"
              />
            </label>
            <label>
              Password
              <span className="password-field">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  placeholder={mode === "register" ? "Minimal 8 karakter" : "Password Anda"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>

            {mode === "register" && (
              <p className="password-hint">
                Gunakan huruf besar, huruf kecil, dan angka.
              </p>
            )}
            {mode === "login" && (
              <p className="auth-forgot">
                <Link href="/auth/forgot">Lupa password?</Link>
              </p>
            )}
            {error && <p className="auth-error" role="alert">{error}</p>}

            {mode === "login" && googleConfigured ? (
              <>
                <a className="button button-ghost auth-google" href="/api/auth/google">
                  Lanjut dengan Google
                </a>
                <p className="auth-divider" role="presentation">
                  <span>atau</span>
                </p>
              </>
            ) : null}

            <button
              className="button button-primary auth-submit"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <><LoaderCircle className="spinner" size={18} /> Memproses...</>
              ) : (
                <>
                  {mode === "login" ? "Masuk ke dashboard" : "Buat akun"}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <p className="auth-switch">
            {mode === "login" ? "Belum memiliki akun?" : "Sudah memiliki akun?"}{" "}
            <button
              type="button"
              onClick={() => changeMode(mode === "login" ? "register" : "login")}
            >
              {mode === "login" ? "Daftar gratis" : "Masuk"}
            </button>
          </p>
          <p className="auth-legal-links">
            <Link href="/terms">Syarat</Link>
            <Link href="/privacy">Privasi</Link>
            <Link href="/cookies">Cookie</Link>
            <Link href="/dpa">DPA</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
