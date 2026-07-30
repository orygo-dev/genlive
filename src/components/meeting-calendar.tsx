"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Plus,
  Video,
  X,
} from "lucide-react";
import {
  buildMonthGrid,
  buildWeekDays,
  calendarRange,
  groupMeetingsByDay,
  isSameMonth,
  sameDay,
  shiftCalendarAnchor,
  toDateKey,
  toLocalInputValue,
  type CalendarView,
} from "@/lib/calendar";
import { meetingStatusLabel } from "@/lib/meeting-access";

type CalendarMeeting = {
  id: string;
  title: string;
  roomName: string;
  status: "SCHEDULED" | "ACTIVE" | "ENDED" | "CANCELLED";
  startsAt: string | null;
  createdAt: string;
};

const WEEKDAY_LABELS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

export function MeetingCalendar({
  organizationId,
}: {
  organizationId: string;
}) {
  const router = useRouter();
  const [view, setView] = useState<CalendarView>("month");
  const [anchor, setAnchor] = useState(() => new Date());
  const [meetings, setMeetings] = useState<CalendarMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [defaultStartsAt, setDefaultStartsAt] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const range = useMemo(() => calendarRange(anchor, view), [anchor, view]);
  const days = useMemo(
    () => (view === "month" ? buildMonthGrid(anchor) : buildWeekDays(anchor)),
    [anchor, view],
  );
  const grouped = useMemo(() => groupMeetingsByDay(meetings), [meetings]);
  const today = useMemo(() => new Date(), []);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        setError("");
        try {
          const params = new URLSearchParams({
            from: range.from.toISOString(),
            to: range.to.toISOString(),
            take: "200",
            status: "ALL",
          });
          const response = await fetch(`/api/meetings?${params.toString()}`, {
            cache: "no-store",
          });
          const payload = (await response.json()) as {
            error?: string;
            meetings?: CalendarMeeting[];
          };
          if (cancelled) return;
          if (!response.ok) {
            throw new Error(payload.error ?? "Kalender belum dapat dimuat.");
          }
          setMeetings(payload.meetings ?? []);
        } catch (requestError) {
          if (!cancelled) {
            setError(
              requestError instanceof Error
                ? requestError.message
                : "Kalender belum dapat dimuat.",
            );
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [range.from, range.to]);

  function openScheduleForDay(day: Date) {
    const suggested = new Date(day);
    suggested.setHours(10, 0, 0, 0);
    if (sameDay(day, new Date()) && new Date().getHours() >= 10) {
      suggested.setHours(new Date().getHours() + 1, 0, 0, 0);
    }
    setDefaultStartsAt(toLocalInputValue(suggested));
    setScheduleOpen(true);
    setError("");
  }

  async function createScheduledMeeting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsCreating(true);
    const formData = new FormData(event.currentTarget);
    const localStart = String(formData.get("startsAt") ?? "");
    const startsAt = new Date(localStart);

    if (!localStart || Number.isNaN(startsAt.getTime()) || startsAt <= new Date()) {
      setError("Pilih waktu meeting di masa mendatang.");
      setIsCreating(false);
      return;
    }

    try {
      const response = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          title: String(formData.get("title") ?? ""),
          startsAt: startsAt.toISOString(),
          waitingRoom: formData.get("waitingRoom") === "on",
          password: String(formData.get("password") ?? ""),
          inviteEmails: String(formData.get("inviteEmails") ?? ""),
          invitePhones: String(formData.get("invitePhones") ?? ""),
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        meeting?: { id: string };
      };
      if (!response.ok || !payload.meeting) {
        throw new Error(payload.error ?? "Meeting belum dapat dibuat.");
      }
      setScheduleOpen(false);
      router.push(`/dashboard/meetings/${payload.meeting.id}`);
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

  const titleLabel = new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(anchor);

  const weekLabel = `${new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
  }).format(days[0])} – ${new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(days[days.length - 1])}`;

  return (
    <div className="calendar-panel">
      <div className="calendar-toolbar">
        <div className="calendar-nav">
          <button
            type="button"
            aria-label="Periode sebelumnya"
            onClick={() => setAnchor((current) => shiftCalendarAnchor(current, view, -1))}
          >
            <ChevronLeft size={18} />
          </button>
          <button type="button" onClick={() => setAnchor(new Date())}>
            Hari ini
          </button>
          <button
            type="button"
            aria-label="Periode berikutnya"
            onClick={() => setAnchor((current) => shiftCalendarAnchor(current, view, 1))}
          >
            <ChevronRight size={18} />
          </button>
          <h2>{view === "month" ? titleLabel : weekLabel}</h2>
        </div>

        <div className="calendar-actions">
          <div className="calendar-view-toggle" role="tablist" aria-label="Tampilan kalender">
            <button
              type="button"
              role="tab"
              aria-selected={view === "month"}
              className={view === "month" ? "active" : undefined}
              onClick={() => setView("month")}
            >
              Bulan
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === "week"}
              className={view === "week" ? "active" : undefined}
              onClick={() => setView("week")}
            >
              Minggu
            </button>
          </div>
          <button
            type="button"
            className="button button-primary"
            onClick={() => openScheduleForDay(new Date())}
          >
            <Plus size={16} /> Jadwalkan
          </button>
        </div>
      </div>

      {error && !scheduleOpen ? <p className="form-error">{error}</p> : null}
      {loading ? <p className="meeting-invite-hint">Memuat jadwal...</p> : null}

      <div className={`calendar-grid calendar-${view}`}>
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="calendar-weekday">
            {label}
          </div>
        ))}

        {days.map((day) => {
          const key = toDateKey(day);
          const dayMeetings = grouped.get(key) ?? [];
          const outside = view === "month" && !isSameMonth(day, anchor);
          return (
            <section
              key={key}
              className={[
                "calendar-day",
                outside ? "outside" : "",
                sameDay(day, today) ? "today" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <header>
                <button
                  type="button"
                  className="calendar-day-number"
                  onClick={() => openScheduleForDay(day)}
                  aria-label={`Jadwalkan pada ${key}`}
                >
                  {day.getDate()}
                </button>
                <button
                  type="button"
                  className="calendar-day-add"
                  onClick={() => openScheduleForDay(day)}
                  aria-label={`Tambah meeting ${key}`}
                >
                  <Plus size={14} />
                </button>
              </header>
              <div className="calendar-day-events">
                {dayMeetings.slice(0, view === "month" ? 3 : 8).map((meeting) => {
                  const time = new Date(meeting.startsAt ?? meeting.createdAt);
                  return (
                    <Link
                      key={meeting.id}
                      href={`/dashboard/meetings/${meeting.id}`}
                      className={`calendar-event status-${meeting.status.toLowerCase()}`}
                      title={`${meeting.title} · ${meetingStatusLabel(meeting.status)}`}
                    >
                      <span>
                        {new Intl.DateTimeFormat("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(time)}
                      </span>
                      <strong>{meeting.title}</strong>
                    </Link>
                  );
                })}
                {dayMeetings.length > (view === "month" ? 3 : 8) ? (
                  <p className="calendar-more">
                    +{dayMeetings.length - (view === "month" ? 3 : 8)} lainnya
                  </p>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>

      {scheduleOpen ? (
        <div className="schedule-backdrop" role="presentation">
          <section
            className="schedule-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="calendar-schedule-title"
          >
            <header>
              <div>
                <span><Video size={19} /></span>
                <div>
                  <h2 id="calendar-schedule-title">Jadwalkan meeting</h2>
                  <p>Buat jadwal langsung dari kalender.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setScheduleOpen(false)}
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </header>

            <form onSubmit={createScheduledMeeting}>
              <label>
                Judul meeting
                <input
                  name="title"
                  placeholder="Contoh: Weekly product sync"
                  required
                />
              </label>
              <label>
                Waktu mulai
                <input
                  name="startsAt"
                  type="datetime-local"
                  defaultValue={defaultStartsAt}
                  required
                />
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
              {error ? <p className="auth-error" role="alert">{error}</p> : null}
              <div className="schedule-footer">
                <button
                  className="button button-ghost"
                  type="button"
                  onClick={() => setScheduleOpen(false)}
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
                  ) : (
                    "Simpan jadwal"
                  )}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
