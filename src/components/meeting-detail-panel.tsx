"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarPlus,
  Copy,
  Download,
  LoaderCircle,
  MailPlus,
  Play,
  Save,
  Trash2,
  Users,
  Video,
} from "lucide-react";
import { googleCalendarUrl } from "@/lib/calendar-links";
import {
  canCancelMeeting,
  canEditMeetingFields,
  canStartMeeting,
  meetingStatusLabel,
} from "@/lib/meeting-access";

export type MeetingDetail = {
  id: string;
  title: string;
  roomName: string;
  status: "SCHEDULED" | "ACTIVE" | "ENDED" | "CANCELLED";
  startsAt: string | null;
  actualStartedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  waitingRoom: boolean;
  passwordRequired: boolean;
  createdBy: { id: string; name: string; email: string };
  _count: { participants: number };
  participants: Array<{
    id: string;
    displayName: string;
    role: "HOST" | "MODERATOR" | "PARTICIPANT";
    joinedAt: string | null;
    leftAt: string | null;
    durationSeconds: number;
  }>;
};

function toLocalInputValue(iso: string | null) {
  if (!iso) {
    return "";
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

export function MeetingDetailPanel({
  meeting,
  canManage,
}: {
  meeting: MeetingDetail;
  canManage: boolean;
}) {
  const router = useRouter();
  const editable = canManage && canEditMeetingFields(meeting.status);
  const [title, setTitle] = useState(meeting.title);
  const [startsAt, setStartsAt] = useState(toLocalInputValue(meeting.startsAt));
  const [waitingRoom, setWaitingRoom] = useState(meeting.waitingRoom);
  const [password, setPassword] = useState("");
  const [clearPassword, setClearPassword] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [inviteEmails, setInviteEmails] = useState("");
  const [invitePhones, setInvitePhones] = useState("");

  const inviteUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return `/meeting/${meeting.roomName}`;
    }
    return `${window.location.origin}/meeting/${meeting.roomName}`;
  }, [meeting.roomName]);

  const calendarLinks = useMemo(() => {
    if (!meeting.startsAt) return null;
    const startsAt = new Date(meeting.startsAt);
    if (Number.isNaN(startsAt.getTime())) return null;

    return {
      icsUrl: `/api/meetings/manage/${meeting.id}/ics`,
      googleUrl: googleCalendarUrl({
        title: meeting.title,
        description: `Meeting ${meeting.title} — ${inviteUrl}`,
        location: inviteUrl,
        startsAt,
      }),
    };
  }, [meeting.id, meeting.startsAt, meeting.title, inviteUrl]);

  async function saveChanges(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editable) {
      return;
    }

    setError("");
    setMessage("");
    setBusy("save");

    const payload: {
      title: string;
      waitingRoom: boolean;
      startsAt?: string;
      password?: string;
    } = {
      title,
      waitingRoom,
    };

    if (meeting.status === "SCHEDULED") {
      if (!startsAt) {
        setError("Jadwal meeting wajib diisi.");
        setBusy("");
        return;
      }
      payload.startsAt = new Date(startsAt).toISOString();
    }

    if (clearPassword) {
      payload.password = "";
    } else if (password.trim()) {
      payload.password = password.trim();
    }

    try {
      const response = await fetch(`/api/meetings/manage/${meeting.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "Meeting belum dapat diperbarui.");
      }

      setPassword("");
      setClearPassword(false);
      setMessage("Perubahan meeting tersimpan.");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Meeting belum dapat diperbarui.",
      );
    } finally {
      setBusy("");
    }
  }

  async function sendInviteEmails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) {
      return;
    }

    if (!inviteEmails.trim() && !invitePhones.trim()) {
      setError("Masukkan minimal satu email atau nomor WhatsApp.");
      return;
    }

    setError("");
    setMessage("");
    setBusy("invite");

    try {
      const response = await fetch(`/api/meetings/manage/${meeting.id}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emails: inviteEmails,
          phones: invitePhones,
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        delivery?: "email" | "manual_link" | "email_failed";
        whatsappDelivery?: "whatsapp" | "manual_link" | "whatsapp_failed";
        invitedCount?: number;
      };

      if (!response.ok) {
        throw new Error(result.error ?? "Undangan meeting belum dapat dikirim.");
      }

      setInviteEmails("");
      setInvitePhones("");

      const summary: string[] = [];
      if (result.delivery === "email") summary.push("Email terkirim");
      if (result.delivery === "email_failed") summary.push("Email gagal");
      if (result.delivery === "manual_link") summary.push("Email belum dikonfigurasi");
      if (result.whatsappDelivery === "whatsapp") summary.push("WhatsApp terkirim");
      if (result.whatsappDelivery === "whatsapp_failed") summary.push("WhatsApp gagal");
      if (result.whatsappDelivery === "manual_link") {
        summary.push("WhatsApp belum dikonfigurasi");
      }

      const hasSuccess =
        result.delivery === "email" || result.whatsappDelivery === "whatsapp";
      if (!hasSuccess) {
        setError(
          `${summary.join(" · ") || "Pengiriman gagal"}. Salin tautan undangan jika perlu.`,
        );
      } else {
        setMessage(
          `Undangan diproses (${result.invitedCount ?? 0} penerima). ${summary.join(" · ")}`,
        );
      }
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Undangan meeting belum dapat dikirim.",
      );
    } finally {
      setBusy("");
    }
  }

  async function copyInvite() {
    setError("");
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/meeting/${meeting.roomName}`,
      );
      setMessage("Tautan undangan disalin.");
    } catch {
      setError("Tautan undangan belum dapat disalin.");
    }
  }

  async function startMeeting() {
    setError("");
    setBusy("start");

    try {
      const response = await fetch(`/api/meetings/manage/${meeting.id}/start`, {
        method: "POST",
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "Meeting belum dapat dimulai.");
      }

      router.push(`/meeting/${meeting.roomName}`);
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Meeting belum dapat dimulai.",
      );
    } finally {
      setBusy("");
    }
  }

  async function cancelMeeting() {
    if (!window.confirm(`Batalkan meeting "${meeting.title}"?`)) {
      return;
    }

    setError("");
    setBusy("cancel");

    try {
      const response = await fetch(`/api/meetings/manage/${meeting.id}/cancel`, {
        method: "POST",
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "Meeting belum dapat dibatalkan.");
      }

      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Meeting belum dapat dibatalkan.",
      );
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="meeting-detail">
      <div className="meeting-detail-toolbar">
        <Link className="meeting-back" href="/dashboard">
          <ArrowLeft size={16} /> Kembali
        </Link>
        <div className="meeting-detail-actions">
          <button type="button" className="button button-ghost" onClick={() => void copyInvite()}>
            <Copy size={15} /> Salin tautan
          </button>
          {canManage && canStartMeeting(meeting.status) ? (
            <button
              type="button"
              className="btn primary"
              disabled={busy === "start"}
              onClick={() => void startMeeting()}
            >
              {busy === "start" ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Play size={16} />
              )}
              Mulai
            </button>
          ) : null}
          {meeting.status === "ACTIVE" ? (
            <Link className="btn primary" href={`/meeting/${meeting.roomName}`}>
              <Play size={16} /> Masuk room
            </Link>
          ) : null}
          {canManage && canCancelMeeting(meeting.status) ? (
            <button
              type="button"
              className="button button-ghost meeting-cancel"
              disabled={busy === "cancel"}
              onClick={() => void cancelMeeting()}
            >
              {busy === "cancel" ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Trash2 size={16} />
              )}
              Batalkan
            </button>
          ) : null}
        </div>
      </div>

      <header className="meeting-detail-header">
        <div>
          <p>{meeting.roomName}</p>
          <h1>{meeting.title}</h1>
        </div>
        <span className={`meeting-status status-${meeting.status.toLowerCase()}`}>
          {meetingStatusLabel(meeting.status)}
        </span>
      </header>

      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="form-success">{message}</p> : null}

      {calendarLinks ? (
        <div className="meeting-calendar-links">
          <a className="button button-ghost" href={calendarLinks.icsUrl} download>
            <Download size={15} /> Unduh ICS
          </a>
          <a
            className="button button-ghost"
            href={calendarLinks.googleUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <CalendarPlus size={15} /> Google Calendar
          </a>
        </div>
      ) : null}

      <div className="meeting-detail-grid">
        <section className="meeting-detail-card">
          <div className="dashboard-section-heading">
            <div>
              <h2>{editable ? "Edit meeting" : "Informasi meeting"}</h2>
              <p>
                Dibuat oleh {meeting.createdBy.name}. Undangan: {inviteUrl}
              </p>
            </div>
          </div>

          {editable ? (
            <form className="meeting-edit-form" onSubmit={saveChanges}>
              <label>
                <span>Judul</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={120}
                  required
                />
              </label>

              {meeting.status === "SCHEDULED" ? (
                <label>
                  <span>Jadwal</span>
                  <input
                    type="datetime-local"
                    value={startsAt}
                    onChange={(event) => setStartsAt(event.target.value)}
                    required
                  />
                </label>
              ) : (
                <div className="meeting-readonly-field">
                  <span>Jadwal</span>
                  <strong>
                    {meeting.startsAt
                      ? new Intl.DateTimeFormat("id-ID", {
                          dateStyle: "full",
                          timeStyle: "short",
                        }).format(new Date(meeting.startsAt))
                      : "—"}
                  </strong>
                </div>
              )}

              <label className="schedule-check">
                <input
                  type="checkbox"
                  checked={waitingRoom}
                  onChange={(event) => setWaitingRoom(event.target.checked)}
                />
                Aktifkan waiting room
              </label>

              <label>
                <span>
                  Password baru{" "}
                  {meeting.passwordRequired ? "(saat ini aktif)" : "(opsional)"}
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (event.target.value) {
                      setClearPassword(false);
                    }
                  }}
                  placeholder="Kosongkan jika tidak diubah"
                  disabled={clearPassword}
                />
              </label>

              {meeting.passwordRequired ? (
                <label className="schedule-check">
                  <input
                    type="checkbox"
                    checked={clearPassword}
                    onChange={(event) => {
                      setClearPassword(event.target.checked);
                      if (event.target.checked) {
                        setPassword("");
                      }
                    }}
                  />
                  Hapus password meeting
                </label>
              ) : null}

              <button className="btn primary" type="submit" disabled={busy === "save"}>
                {busy === "save" ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <Save size={16} />
                )}
                Simpan perubahan
              </button>
            </form>
          ) : (
            <dl className="meeting-meta-list">
              <div>
                <dt>Jadwal</dt>
                <dd>
                  {meeting.startsAt
                    ? new Intl.DateTimeFormat("id-ID", {
                        dateStyle: "full",
                        timeStyle: "short",
                      }).format(new Date(meeting.startsAt))
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>Waiting room</dt>
                <dd>{meeting.waitingRoom ? "Aktif" : "Nonaktif"}</dd>
              </div>
              <div>
                <dt>Password</dt>
                <dd>{meeting.passwordRequired ? "Aktif" : "Tidak ada"}</dd>
              </div>
              <div>
                <dt>Peserta bergabung</dt>
                <dd>{meeting._count.participants}</dd>
              </div>
            </dl>
          )}
        </section>

        <section className="meeting-detail-card">
          <div className="dashboard-section-heading">
            <div>
              <h2>Undang peserta</h2>
              <p>Kirim undangan via email dan/atau WhatsApp (Fonnte).</p>
            </div>
          </div>

          {canManage &&
          meeting.status !== "ENDED" &&
          meeting.status !== "CANCELLED" ? (
            <form className="meeting-edit-form" onSubmit={sendInviteEmails}>
              <label>
                <span>Email peserta</span>
                <input
                  type="text"
                  value={inviteEmails}
                  onChange={(event) => setInviteEmails(event.target.value)}
                  placeholder="nama@perusahaan.com, teman@email.com"
                />
              </label>
              <label>
                <span>WhatsApp peserta</span>
                <input
                  type="text"
                  value={invitePhones}
                  onChange={(event) => setInvitePhones(event.target.value)}
                  placeholder="081234567890, 62812xxxxxxx"
                />
              </label>
              <button
                className="button button-primary"
                type="submit"
                disabled={busy === "invite"}
              >
                {busy === "invite" ? (
                  <LoaderCircle className="spinner" size={16} />
                ) : (
                  <MailPlus size={16} />
                )}
                Kirim undangan
              </button>
            </form>
          ) : (
            <p className="meeting-invite-hint">
              Salin tautan undangan untuk membagikan meeting ini.
            </p>
          )}

          <div className="dashboard-section-heading meeting-participants-heading">
            <div>
              <h2>Peserta</h2>
              <p>Orang yang sudah pernah bergabung ke room.</p>
            </div>
          </div>

          {meeting.participants.length === 0 ? (
            <div className="dashboard-empty members-empty">
              <span><Users size={24} /></span>
              <h3>Belum ada peserta</h3>
              <p>Salin tautan undangan untuk mengajak tim Anda.</p>
            </div>
          ) : (
            <div className="meeting-participants">
              {meeting.participants.map((participant) => (
                <article key={participant.id}>
                  <span className="meeting-history-icon"><Video size={16} /></span>
                  <div>
                    <strong>{participant.displayName}</strong>
                    <p>
                      {participant.role} ·{" "}
                      {Math.round(participant.durationSeconds / 60)} menit
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
