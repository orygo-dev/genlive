"use client";

import { useState } from "react";

export function EmailVerifyBanner({ emailVerified }: { emailVerified: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [hidden, setHidden] = useState(false);

  if (emailVerified || hidden) return null;

  async function resend() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
      });
      const payload = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Gagal mengirim ulang.");
      }
      setMessage(payload.message || "Email verifikasi dikirim ulang.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengirim ulang.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="email-verify-banner" role="status">
      <div>
        <strong>Verifikasi email Anda</strong>
        <p>
          Akun aktif, tapi email belum diverifikasi. Cek kotak masuk atau kirim
          ulang tautan.
        </p>
        {message ? <p className="form-success">{message}</p> : null}
        {error ? <p className="form-error">{error}</p> : null}
      </div>
      <div className="email-verify-actions">
        <button
          type="button"
          className="button button-ghost"
          disabled={busy}
          onClick={() => void resend()}
        >
          {busy ? "Mengirim…" : "Kirim ulang"}
        </button>
        <button
          type="button"
          className="button button-ghost"
          onClick={() => setHidden(true)}
        >
          Nanti
        </button>
      </div>
    </div>
  );
}
