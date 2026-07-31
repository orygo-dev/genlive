"use client";

import { useEffect, useState } from "react";
import { BarChart3, Download, LoaderCircle } from "lucide-react";

type MonthlyRow = {
  month: string;
  label: string;
  meetingCount: number;
  participantMinutes: number;
  recordingCount: number;
};

type AnalyticsPayload = {
  usageThisMonth: {
    memberCount: number;
    meetingCount: number;
    meetingMinutes: number;
    recordingMinutes: number;
  };
  monthly: MonthlyRow[];
  recentMeetings: Array<{
    id: string;
    title: string;
    status: string;
    startsAt: string | null;
    createdAt: string;
    endedAt: string | null;
    participantCount: number;
    recordingCount: number;
  }>;
};

function maxValue(rows: MonthlyRow[], key: keyof MonthlyRow) {
  return Math.max(
    1,
    ...rows.map((row) => (typeof row[key] === "number" ? (row[key] as number) : 0)),
  );
}

export function AnalyticsPanel() {
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch("/api/organizations/analytics", {
            cache: "no-store",
          });
          const payload = (await response.json()) as AnalyticsPayload & {
            error?: string;
          };
          if (cancelled) return;
          if (!response.ok) {
            throw new Error(payload.error ?? "Analytics belum dapat dimuat.");
          }
          setData(payload);
        } catch (requestError) {
          if (!cancelled) {
            setError(
              requestError instanceof Error
                ? requestError.message
                : "Analytics belum dapat dimuat.",
            );
          }
        }
      })();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  if (!data && !error) {
    return <p className="meeting-invite-hint">Memuat analytics...</p>;
  }

  if (!data) {
    return <p className="form-error">{error}</p>;
  }

  const meetingMax = maxValue(data.monthly, "meetingCount");
  const minutesMax = maxValue(data.monthly, "participantMinutes");
  const recordingMax = maxValue(data.monthly, "recordingCount");

  return (
    <div className="analytics-panel">
      <section className="meeting-detail-card">
        <div className="dashboard-section-heading">
          <div>
            <h2>Penggunaan bulan ini</h2>
            <p>Ringkasan kuota workspace aktif.</p>
          </div>
          <a
            className="button button-ghost"
            href="/api/organizations/analytics/export"
          >
            <Download size={16} /> Unduh CSV
          </a>
        </div>
        <div className="billing-usage">
          <article>
            <strong>{data.usageThisMonth.memberCount}</strong>
            <p>Anggota</p>
          </article>
          <article>
            <strong>{data.usageThisMonth.meetingCount}</strong>
            <p>Meeting</p>
          </article>
          <article>
            <strong>{data.usageThisMonth.meetingMinutes}</strong>
            <p>Menit peserta</p>
          </article>
          <article>
            <strong>{data.usageThisMonth.recordingMinutes}</strong>
            <p>Menit recording</p>
          </article>
        </div>
      </section>

      <section className="meeting-detail-card">
        <div className="dashboard-section-heading">
          <div>
            <h2>
              <BarChart3 size={18} /> Tren 6 bulan
            </h2>
            <p>Meeting, menit peserta, dan recording per bulan.</p>
          </div>
        </div>

        <div className="analytics-chart-grid">
          {data.monthly.map((row) => (
            <article key={row.month} className="analytics-month-card">
              <strong>{row.label}</strong>
              <div className="analytics-bar-group">
                <div className="analytics-bar-row">
                  <span>Meeting</span>
                  <div className="analytics-bar-track">
                    <div
                      className="analytics-bar analytics-bar-meeting"
                      style={{
                        width: `${Math.round((row.meetingCount / meetingMax) * 100)}%`,
                      }}
                    />
                  </div>
                  <em>{row.meetingCount}</em>
                </div>
                <div className="analytics-bar-row">
                  <span>Menit</span>
                  <div className="analytics-bar-track">
                    <div
                      className="analytics-bar analytics-bar-minutes"
                      style={{
                        width: `${Math.round((row.participantMinutes / minutesMax) * 100)}%`,
                      }}
                    />
                  </div>
                  <em>{row.participantMinutes}</em>
                </div>
                <div className="analytics-bar-row">
                  <span>Rekaman</span>
                  <div className="analytics-bar-track">
                    <div
                      className="analytics-bar analytics-bar-recording"
                      style={{
                        width: `${Math.round((row.recordingCount / recordingMax) * 100)}%`,
                      }}
                    />
                  </div>
                  <em>{row.recordingCount}</em>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="meeting-detail-card">
        <div className="dashboard-section-heading">
          <div>
            <h2>Meeting terbaru</h2>
            <p>10 meeting terakhir di workspace ini.</p>
          </div>
        </div>
        {data.recentMeetings.length === 0 ? (
          <p className="meeting-invite-hint">Belum ada meeting.</p>
        ) : (
          <div className="recording-list">
            {data.recentMeetings.map((meeting) => (
              <article key={meeting.id}>
                <div>
                  <strong>{meeting.title}</strong>
                  <p>
                    {meeting.status} · {meeting.participantCount} peserta ·{" "}
                    {meeting.recordingCount} recording ·{" "}
                    {new Intl.DateTimeFormat("id-ID", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(meeting.createdAt))}
                  </p>
                </div>
                <a className="button button-ghost" href={`/dashboard/meetings/${meeting.id}`}>
                  Detail
                </a>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
