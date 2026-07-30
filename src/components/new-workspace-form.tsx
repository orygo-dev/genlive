"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, LoaderCircle } from "lucide-react";

export function NewWorkspaceForm({ userName }: { userName: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Workspace belum dapat dibuat.");
      }
      router.push("/dashboard");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Workspace belum dapat dibuat.",
      );
      setBusy(false);
    }
  }

  return (
    <div className="invite-page">
      <section className="invite-card">
        <div className="invite-icon">
          <Building2 size={24} />
        </div>
        <h1>Buat workspace</h1>
        <p>
          Halo {userName}. Anda belum punya workspace aktif. Buat yang baru untuk
          mulai menjadwalkan meeting.
        </p>
        <form onSubmit={onSubmit} className="settings-form">
          <label>
            Nama workspace
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Contoh: Tim Marketing"
              maxLength={100}
              required
              autoFocus
            />
          </label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button
            className="button button-primary button-full"
            type="submit"
            disabled={busy}
          >
            {busy ? (
              <>
                <LoaderCircle className="spinner" size={16} /> Membuat...
              </>
            ) : (
              "Buat workspace"
            )}
          </button>
        </form>
      </section>
    </div>
  );
}
