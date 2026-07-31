"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, LoaderCircle, XCircle } from "lucide-react";

export function VerifyEmailClient({ token }: { token: string }) {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("Tautan verifikasi tidak valid.");
      return;
    }

    let active = true;

    async function verify() {
      try {
        const response = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const result = (await response.json()) as { error?: string };

        if (!active) return;

        if (!response.ok) {
          setStatus("error");
          setError(result.error ?? "Verifikasi gagal.");
          return;
        }

        setStatus("success");
      } catch {
        if (active) {
          setStatus("error");
          setError("Verifikasi belum dapat diproses.");
        }
      }
    }

    void verify();
    return () => {
      active = false;
    };
  }, [token]);

  if (status === "loading") {
    return (
      <div className="auth-form verify-email-status">
        <LoaderCircle className="spinner" size={32} />
        <p>Memverifikasi email Anda...</p>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="auth-form verify-email-status">
        <CheckCircle2 size={36} className="verify-success-icon" />
        <p className="form-success">Email berhasil diverifikasi.</p>
        <Link className="button button-primary auth-submit" href="/dashboard">
          Lanjut ke dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="auth-form verify-email-status">
      <XCircle size={36} className="verify-error-icon" />
      <p className="auth-error" role="alert">{error}</p>
      <Link className="button button-ghost auth-submit" href="/auth">
        Kembali ke masuk
      </Link>
    </div>
  );
}
