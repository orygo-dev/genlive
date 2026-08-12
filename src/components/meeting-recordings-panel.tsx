"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Circle,
  Download,
  LoaderCircle,
  Square,
  Video,
} from "lucide-react";
import { RecordingConsentModal } from "@/components/recording-consent-modal";
import { recordingStatusLabel } from "@/lib/recording-helpers";

type RecordingRow = {
  id: string;
  status: "STARTING" | "ACTIVE" | "ENDING" | "COMPLETE" | "FAILED" | "ABORTED";
  filepath: string | null;
  downloadUrl: string | null;
  durationSeconds: number | null;
  startedAt: string;
  endedAt: string | null;
  errorMessage: string | null;
  startedBy: { name: string } | null;
};

export function MeetingRecordingsPanel({
  meetingId,
  canManage,
  meetingStatus,
}: {
  meetingId: string;
  canManage: boolean;
  meetingStatus: "SCHEDULED" | "ACTIVE" | "ENDED" | "CANCELLED";
}) {
  const router = useRouter();
  const [recordings, setRecordings] = useState<RecordingRow[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [consentOpen, setConsentOpen] = useState(false);

  async function loadRecordings() {
    const response = await fetch(`/api/meetings/manage/${meetingId}/recording`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as { recordings: RecordingRow[] };
    setRecordings(payload.recordings);
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const response = await fetch(
        `/api/meetings/manage/${meetingId}/recording`,
        { cache: "no-store" },
      );
      if (cancelled || !response.ok) {
        return;
      }
      const payload = (await response.json()) as { recordings: RecordingRow[] };
      setRecordings(payload.recordings);
      setLoading(false);
    }

    const immediate = window.setTimeout(() => {
      void refresh();
    }, 0);
    const timer = window.setInterval(() => {
      void refresh();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearTimeout(immediate);
      window.clearInterval(timer);
    };
  }, [meetingId]);

  async function runAction(action: "start" | "stop", event?: FormEvent) {
    event?.preventDefault();
    setError("");
    setBusy(action);

    try {
      const response = await fetch(
        `/api/meetings/manage/${meetingId}/recording?action=${action}`,
        {
          method: "POST",
          headers:
            action === "start"
              ? { "Content-Type": "application/json" }
              : undefined,
          body:
            action === "start"
              ? JSON.stringify({ consentAcknowledged: true })
              : undefined,
        },
      );
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Recording belum dapat diproses.");
      }
      setConsentOpen(false);
      await loadRecordings();
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Recording belum dapat diproses.",
      );
    } finally {
      setBusy("");
    }
  }

  const active = recordings.find((item) =>
    ["STARTING", "ACTIVE", "ENDING"].includes(item.status),
  );

  return (
    <section className="meeting-detail-card">
      <div className="dashboard-section-heading">
        <div>
          <h2>Recording</h2>
          <p>Rekaman room composite LiveKit untuk meeting ini.</p>
        </div>
      </div>

      {canManage && meetingStatus === "ACTIVE" ? (
        <form
          className="meeting-edit-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (active) {
              void runAction("stop", event);
            } else {
              setConsentOpen(true);
            }
          }}
        >
          <button
            className={
              active ? "button button-ghost meeting-cancel" : "button button-primary"
            }
            type="submit"
            disabled={Boolean(busy) || active?.status === "ENDING"}
          >
            {busy ? (
              <LoaderCircle className="spin" size={16} />
            ) : active ? (
              <Square size={16} />
            ) : (
              <Circle size={16} />
            )}
            {active ? "Hentikan recording" : "Mulai recording"}
          </button>
        </form>
      ) : null}

      <RecordingConsentModal
        open={consentOpen}
        busy={busy === "start"}
        onCancel={() => setConsentOpen(false)}
        onConfirm={() => void runAction("start")}
      />

      {error ? <p className="form-error">{error}</p> : null}

      {loading ? (
        <p className="meeting-invite-hint">Memuat recording...</p>
      ) : recordings.length === 0 ? (
        <div className="dashboard-empty members-empty">
          <span><Video size={24} /></span>
          <h3>Belum ada recording</h3>
          <p>Mulai recording saat meeting aktif untuk menyimpan rekaman.</p>
        </div>
      ) : (
        <div className="recording-list">
          {recordings.map((recording) => (
            <article key={recording.id}>
              <div>
                <strong>{recordingStatusLabel(recording.status)}</strong>
                <p>
                  {new Intl.DateTimeFormat("id-ID", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(recording.startedAt))}
                  {recording.durationSeconds
                    ? ` · ${Math.round(recording.durationSeconds / 60)} menit`
                    : ""}
                  {recording.startedBy ? ` · ${recording.startedBy.name}` : ""}
                </p>
                {recording.errorMessage ? (
                  <p className="form-error">{recording.errorMessage}</p>
                ) : null}
              </div>
              {recording.status === "COMPLETE" && recording.downloadUrl ? (
                <a
                  className="button button-ghost"
                  href={recording.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Download size={15} /> Unduh
                </a>
              ) : recording.status === "COMPLETE" ? (
                <span className="meeting-invite-hint">
                  Selesai — atur Public URL R2 di Integrasi untuk unduh
                </span>
              ) : (
                <span className={`role-chip status-${recording.status.toLowerCase()}`}>
                  {recordingStatusLabel(recording.status)}
                </span>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
