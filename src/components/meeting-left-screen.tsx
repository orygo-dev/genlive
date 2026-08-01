"use client";

import Link from "next/link";
import { Home, LayoutDashboard, Video } from "lucide-react";

type MeetingLeftScreenProps = {
  roomName?: string | null;
  title?: string | null;
  role?: "HOST" | "MODERATOR" | "PARTICIPANT" | null;
};

export function MeetingLeftScreen({
  roomName,
  title,
  role,
}: MeetingLeftScreenProps) {
  const isHost = role === "HOST" || role === "MODERATOR";
  const rejoinHref = roomName
    ? `/meeting/${encodeURIComponent(roomName)}`
    : "/";

  return (
    <main className="meeting-left-page">
      <section className="meeting-left-card">
        <div className="meeting-left-icon">
          <Video size={28} />
        </div>
        <p className="prejoin-kicker">Meeting berakhir untuk Anda</p>
        <h1>Anda telah keluar</h1>
        <p className="meeting-left-copy">
          {title
            ? `Anda keluar dari “${title}”.`
            : "Anda sudah meninggalkan meeting."}{" "}
          Anda dapat bergabung lagi jika meeting masih berlangsung.
        </p>
        <div className="meeting-left-actions">
          {roomName ? (
            <Link className="button button-primary" href={rejoinHref}>
              Gabung lagi
            </Link>
          ) : null}
          {isHost ? (
            <Link className="button button-ghost" href="/dashboard">
              <LayoutDashboard size={16} /> Dashboard
            </Link>
          ) : (
            <Link className="button button-ghost" href="/">
              <Home size={16} /> Beranda
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}
