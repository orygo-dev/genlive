"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  LoaderCircle,
  MailCheck,
  Video,
} from "lucide-react";
import { roleLabel, type OrgRoleLabel } from "@/lib/organization-labels";

type InvitePreview = {
  email: string;
  role: OrgRoleLabel;
  organizationName: string;
  invitedByName: string;
  expiresAt: string;
};

export function InviteExperience({
  token,
  preview,
  previewError,
  isAuthenticated,
  currentEmail,
}: {
  token: string;
  preview: InvitePreview | null;
  previewError: string | null;
  isAuthenticated: boolean;
  currentEmail: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState(previewError ?? "");
  const [isAccepting, setIsAccepting] = useState(false);

  async function acceptInvite() {
    setError("");
    setIsAccepting(true);

    try {
      const response = await fetch("/api/organizations/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "Undangan belum dapat diterima.");
      }

      router.replace("/dashboard/members");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Undangan belum dapat diterima.",
      );
    } finally {
      setIsAccepting(false);
    }
  }

  const emailMismatch =
    isAuthenticated &&
    preview &&
    currentEmail &&
    currentEmail !== preview.email;

  return (
    <main className="invite-page">
      <section className="invite-card">
        <Link className="brand" href="/">
          <span className="brand-mark"><Video size={19} /></span>
          <span>GenMeet</span>
        </Link>

        {preview ? (
          <>
            <span className="invite-icon"><MailCheck size={28} /></span>
            <h1>Undangan ke {preview.organizationName}</h1>
            <p>
              {preview.invitedByName} mengundang {preview.email} sebagai{" "}
              {roleLabel(preview.role)}.
            </p>
            <p className="invite-expiry">
              Berlaku hingga{" "}
              {new Intl.DateTimeFormat("id-ID", {
                dateStyle: "full",
                timeStyle: "short",
              }).format(new Date(preview.expiresAt))}
            </p>

            {!isAuthenticated ? (
              <div className="invite-actions">
                <Link
                  className="btn primary"
                  href={`/auth?next=${encodeURIComponent(`/invite/${token}`)}`}
                >
                  Masuk untuk menerima <ArrowRight size={16} />
                </Link>
                <p className="invite-hint">
                  Gunakan akun dengan email {preview.email}.
                </p>
              </div>
            ) : emailMismatch ? (
              <p className="form-error">
                Anda masuk sebagai {currentEmail}. Keluar lalu masuk dengan{" "}
                {preview.email} untuk menerima undangan.
              </p>
            ) : (
              <button
                type="button"
                className="btn primary"
                disabled={isAccepting}
                onClick={() => void acceptInvite()}
              >
                {isAccepting ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <MailCheck size={16} />
                )}
                Terima undangan
              </button>
            )}
          </>
        ) : (
          <>
            <h1>Undangan tidak tersedia</h1>
            <p>{error || "Tautan undangan tidak valid atau sudah tidak aktif."}</p>
            <Link className="btn primary" href="/dashboard">
              Ke dashboard
            </Link>
          </>
        )}

        {error && preview ? <p className="form-error">{error}</p> : null}
      </section>
    </main>
  );
}
