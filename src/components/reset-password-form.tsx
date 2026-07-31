"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LoaderCircle } from "lucide-react";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "Password belum dapat diperbarui.");
      }

      router.replace("/auth");
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

  if (!token) {
    return (
      <div className="auth-form">
        <p className="auth-error" role="alert">
          Tautan reset tidak valid. Minta tautan baru dari halaman lupa password.
        </p>
        <p className="auth-switch">
          <Link href="/auth/forgot">Minta tautan reset</Link>
        </p>
      </div>
    );
  }

  return (
    <form className="auth-form" onSubmit={submit} noValidate>
      <label>
        Password baru
        <span className="password-field">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            placeholder="Minimal 8 karakter"
            required
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
      <p className="password-hint">Gunakan huruf besar, huruf kecil, dan angka.</p>

      {error ? <p className="auth-error" role="alert">{error}</p> : null}

      <button className="button button-primary auth-submit" type="submit" disabled={isSubmitting}>
        {isSubmitting ? (
          <><LoaderCircle className="spinner" size={18} /> Menyimpan...</>
        ) : (
          <>Simpan password baru <ArrowRight size={18} /></>
        )}
      </button>
    </form>
  );
}
