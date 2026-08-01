"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  LoaderCircle,
  LogOut,
  Plus,
  Video,
  X,
} from "lucide-react";
import { normalizeRoomName } from "@/lib/meeting";

export function DashboardActions({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [waitingRoom, setWaitingRoom] = useState(true);

  async function requestMeeting(
    payload: {
      title: string;
      startsAt?: string;
      waitingRoom?: boolean;
      password?: string;
      inviteEmails?: string;
      invitePhones?: string;
    },
    enterMeeting: boolean,
  ) {
    setError("");
    setIsCreating(true);

    try {
      const response = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, ...payload }),
      });
      const result = (await response.json()) as {
        error?: string;
        meeting?: { id: string; roomName: string };
      };

      if (!response.ok || !result.meeting) {
        throw new Error(result.error ?? "Meeting belum dapat dibuat.");
      }

      if (enterMeeting) {
        router.push(`/meeting/${result.meeting.roomName}`);
      } else {
        setIsScheduleOpen(false);
        router.push(`/dashboard/meetings/${result.meeting.id}`);
        router.refresh();
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Meeting belum dapat dibuat.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  function createMeeting() {
    void requestMeeting(
      { title: "Meeting instan", waitingRoom },
      true,
    );
  }

  function scheduleMeeting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const localStart = String(formData.get("startsAt") ?? "");
    const startsAt = new Date(localStart);

    if (!localStart || Number.isNaN(startsAt.getTime()) || startsAt <= new Date()) {
      setError("Pilih waktu meeting di masa mendatang.");
      return;
    }

    void requestMeeting(
      {
        title: String(formData.get("title") ?? ""),
        startsAt: startsAt.toISOString(),
        waitingRoom: formData.get("waitingRoom") === "on",
        password: String(formData.get("password") ?? ""),
        inviteEmails: String(formData.get("inviteEmails") ?? ""),
        invitePhones: String(formData.get("invitePhones") ?? ""),
      },
      false,
    );
  }

  function joinMeeting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const roomName = normalizeRoomName(roomCode);

    if (roomName.length < 3) {
      setError("Kode meeting minimal 3 karakter.");
      return;
    }

    router.push(`/meeting/${roomName}`);
  }

  async function logout() {
    setIsLoggingOut(true);

    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        throw new Error();
      }
      router.replace("/");
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <>
      <button
        className="dashboard-logout"
        type="button"
        onClick={logout}
        disabled={isLoggingOut}
      >
        <LogOut size={17} />
        {isLoggingOut ? "Keluar..." : "Keluar"}
      </button>

      <div className="dashboard-zoom-strip" aria-label="Aksi meeting">
        <button
          className="dashboard-zoom-tile dashboard-zoom-tile-primary"
          onClick={createMeeting}
          disabled={isCreating}
          type="button"
        >
          <Plus size={22} />
          <strong>Meeting baru</strong>
          <span>Mulai rapat instan sekarang</span>
        </button>
        <button
          className="dashboard-zoom-tile"
          type="button"
          onClick={() => {
            setError("");
            setIsScheduleOpen(true);
          }}
        >
          <CalendarDays size={22} />
          <strong>Jadwalkan</strong>
          <span>Atur waktu dan undang peserta</span>
        </button>
        <form className="dashboard-zoom-tile dashboard-zoom-join" onSubmit={joinMeeting} noValidate>
          <Video size={22} />
          <strong>Gabung</strong>
          <input
            value={roomCode}
            onChange={(event) => {
              setRoomCode(event.target.value);
              setError("");
            }}
            placeholder="Kode meeting"
            aria-label="Kode meeting"
            aria-invalid={Boolean(error)}
          />
          <button type="submit" aria-label="Gabung meeting">
            <ArrowRight size={18} />
          </button>
        </form>
      </div>

      <label className="dashboard-waiting-toggle">
        <input
          type="checkbox"
          checked={waitingRoom}
          onChange={(event) => setWaitingRoom(event.target.checked)}
        />
        <span>
          <strong>Ruang tunggu</strong> untuk meeting baru
        </span>
      </label>

      {error && <p className="form-error dashboard-error" role="alert">{error}</p>}

      {isScheduleOpen && (
        <div className="schedule-backdrop" role="presentation">
          <section
            className="schedule-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-title"
          >
            <header>
              <div>
                <span><CalendarDays size={19} /></span>
                <div>
                  <h2 id="schedule-title">Jadwalkan meeting</h2>
                  <p>Atur waktu dan akses peserta.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsScheduleOpen(false)}
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </header>

            <form onSubmit={scheduleMeeting}>
              <label>
                Judul meeting
                <input name="title" placeholder="Contoh: Weekly product sync" required />
              </label>
              <label>
                Waktu mulai
                <input name="startsAt" type="datetime-local" required />
              </label>
              <label>
                Password opsional
                <input
                  name="password"
                  type="password"
                  placeholder="Kosongkan jika tidak diperlukan"
                  maxLength={72}
                />
              </label>
              <label>
                Undang via email (opsional)
                <input
                  name="inviteEmails"
                  type="text"
                  placeholder="nama@perusahaan.com, teman@email.com"
                />
              </label>
              <label>
                Undang via WhatsApp (opsional)
                <input
                  name="invitePhones"
                  type="text"
                  placeholder="081234567890, 62812xxxxxxx"
                />
              </label>
              <label className="schedule-check">
                <input name="waitingRoom" type="checkbox" defaultChecked />
                <span>
                  <strong>Aktifkan waiting room</strong>
                  <small>Host menyetujui peserta sebelum masuk.</small>
                </span>
              </label>
              {error && <p className="auth-error" role="alert">{error}</p>}
              <div className="schedule-footer">
                <button
                  className="button button-ghost"
                  type="button"
                  onClick={() => setIsScheduleOpen(false)}
                >
                  Batal
                </button>
                <button
                  className="button button-primary"
                  type="submit"
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <><LoaderCircle className="spinner" size={17} /> Menyimpan...</>
                  ) : (
                    "Simpan jadwal"
                  )}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
