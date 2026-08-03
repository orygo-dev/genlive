"use client";

import { FormEvent, useMemo, useState } from "react";
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

type CreateMode = "now" | "schedule";

function defaultLocalStartsAt() {
  const date = new Date(Date.now() + 60 * 60_000);
  date.setMinutes(0, 0, 0);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

export function DashboardActions({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createMode, setCreateMode] = useState<CreateMode>("now");
  const [title, setTitle] = useState("Meeting instan");
  const [startsAtLocal, setStartsAtLocal] = useState(defaultLocalStartsAt);
  const [waitingRoom, setWaitingRoom] = useState(false);
  const [password, setPassword] = useState("");
  const [inviteEmails, setInviteEmails] = useState("");
  const [invitePhones, setInvitePhones] = useState("");

  const modalTitle = useMemo(
    () => (createMode === "now" ? "Meeting baru" : "Jadwalkan meeting"),
    [createMode],
  );

  function openCreateModal(mode: CreateMode) {
    setError("");
    setCreateMode(mode);
    setTitle(mode === "now" ? "Meeting instan" : "");
    setStartsAtLocal(defaultLocalStartsAt());
    setWaitingRoom(false);
    setPassword("");
    setInviteEmails("");
    setInvitePhones("");
    setIsCreateOpen(true);
  }

  async function requestMeeting(payload: {
    title: string;
    startsAt?: string;
    waitingRoom?: boolean;
    password?: string;
    inviteEmails?: string;
    invitePhones?: string;
  }) {
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

      setIsCreateOpen(false);
      router.push(`/dashboard/meetings/${result.meeting.id}`);
      router.refresh();
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

  function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim() || "Meeting instan";

    if (createMode === "schedule") {
      const startsAt = new Date(startsAtLocal);
      if (
        !startsAtLocal ||
        Number.isNaN(startsAt.getTime()) ||
        startsAt <= new Date()
      ) {
        setError("Pilih waktu meeting di masa mendatang.");
        return;
      }

      void requestMeeting({
        title: trimmedTitle,
        startsAt: startsAt.toISOString(),
        waitingRoom,
        password,
        inviteEmails,
        invitePhones,
      });
      return;
    }

    void requestMeeting({
      title: trimmedTitle,
      waitingRoom,
      password: password || undefined,
    });
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
          onClick={() => openCreateModal("now")}
          disabled={isCreating}
          type="button"
        >
          <Plus size={22} />
          <strong>Meeting baru</strong>
          <span>Atur judul lalu mulai atau jadwalkan</span>
        </button>
        <button
          className="dashboard-zoom-tile"
          type="button"
          onClick={() => openCreateModal("schedule")}
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
            aria-invalid={Boolean(error) && !isCreateOpen}
          />
          <button type="submit" aria-label="Gabung meeting">
            <ArrowRight size={18} />
          </button>
        </form>
      </div>

      {error && !isCreateOpen ? (
        <p className="form-error dashboard-error" role="alert">
          {error}
        </p>
      ) : null}

      {isCreateOpen ? (
        <div className="schedule-backdrop" role="presentation">
          <section
            className="schedule-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-meeting-title"
          >
            <header>
              <div>
                <span>
                  {createMode === "now" ? <Plus size={19} /> : <CalendarDays size={19} />}
                </span>
                <div>
                  <h2 id="create-meeting-title">{modalTitle}</h2>
                  <p>Satu langkah: isi detail, lalu masuk dari halaman meeting.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </header>

            <form onSubmit={submitCreate}>
              <div className="create-mode-toggle" role="radiogroup" aria-label="Jenis meeting">
                <label className={createMode === "now" ? "active" : undefined}>
                  <input
                    type="radio"
                    name="createMode"
                    checked={createMode === "now"}
                    onChange={() => {
                      setCreateMode("now");
                      setError("");
                      if (!title.trim()) setTitle("Meeting instan");
                    }}
                  />
                  Mulai sekarang
                </label>
                <label className={createMode === "schedule" ? "active" : undefined}>
                  <input
                    type="radio"
                    name="createMode"
                    checked={createMode === "schedule"}
                    onChange={() => {
                      setCreateMode("schedule");
                      setError("");
                      if (title === "Meeting instan") setTitle("");
                    }}
                  />
                  Jadwalkan
                </label>
              </div>

              <label>
                Judul meeting
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Contoh: Weekly product sync"
                  required={createMode === "schedule"}
                />
              </label>

              {createMode === "schedule" ? (
                <>
                  <label>
                    Waktu mulai
                    <input
                      type="datetime-local"
                      value={startsAtLocal}
                      onChange={(event) => setStartsAtLocal(event.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Undang via email (opsional)
                    <input
                      value={inviteEmails}
                      onChange={(event) => setInviteEmails(event.target.value)}
                      type="text"
                      placeholder="nama@perusahaan.com, teman@email.com"
                    />
                  </label>
                  <label>
                    Undang via WhatsApp (opsional)
                    <input
                      value={invitePhones}
                      onChange={(event) => setInvitePhones(event.target.value)}
                      type="text"
                      placeholder="081234567890, 62812xxxxxxx"
                    />
                  </label>
                </>
              ) : null}

              <label>
                Password opsional
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Kosongkan jika tidak diperlukan"
                  maxLength={72}
                />
              </label>

              <label className="schedule-check">
                <input
                  type="checkbox"
                  checked={waitingRoom}
                  onChange={(event) => setWaitingRoom(event.target.checked)}
                />
                <span>
                  <strong>Aktifkan waiting room</strong>
                  <small>Host menyetujui peserta sebelum masuk.</small>
                </span>
              </label>

              {error ? <p className="auth-error" role="alert">{error}</p> : null}

              <div className="schedule-footer">
                <button
                  className="button button-ghost"
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Batal
                </button>
                <button
                  className="button button-primary"
                  type="submit"
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <>
                      <LoaderCircle className="spinner" size={17} /> Menyimpan...
                    </>
                  ) : createMode === "now" ? (
                    "Buat meeting"
                  ) : (
                    "Simpan jadwal"
                  )}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
