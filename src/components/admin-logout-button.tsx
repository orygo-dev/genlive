"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, LoaderCircle } from "lucide-react";

export function AdminLogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/auth");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className="button button-ghost"
      onClick={() => void logout()}
      disabled={busy}
    >
      {busy ? <LoaderCircle className="spinner" size={16} /> : <LogOut size={16} />}
      Keluar
    </button>
  );
}
