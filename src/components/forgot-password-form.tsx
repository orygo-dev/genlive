"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowLeft, LoaderCircle, Mail } from "lucide-react";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = (await response.json()) as { message?: string; error?: string };
      setMessage(
        result.message ??
          "Jika email terdaftar, kami mengirim tautan reset password. Periksa kotak masuk Anda.",
      );
    } catch {
      setError("Permintaan belum dapat diproses. Silakan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit} noValidate>
      <label>
        Email
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          placeholder="nama@perusahaan.com"
          required
        />
      </label>

      {error ? <p className="auth-error" role="alert">{error}</p> : null}
      {message ? <p className="form-success" role="status">{message}</p> : null}

      <button className="button button-primary auth-submit" type="submit" disabled={isSubmitting}>
        {isSubmitting ? (
          <><LoaderCircle className="spinner" size={18} /> Mengirim...</>
        ) : (
          <><Mail size={18} /> Kirim tautan reset</>
        )}
      </button>

      <p className="auth-switch">
        <Link href="/auth">
          <ArrowLeft size={14} /> Kembali ke masuk
        </Link>
      </p>
    </form>
  );
}
