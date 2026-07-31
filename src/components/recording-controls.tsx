"use client";

import { useCallback, useEffect, useState } from "react";
import { Circle, LoaderCircle, Square } from "lucide-react";
import { RecordingConsentModal } from "@/components/recording-consent-modal";
import { recordingStatusLabel } from "@/lib/recording-helpers";

type ActiveRecording = {
  id: string;
  status: "STARTING" | "ACTIVE" | "ENDING" | "COMPLETE" | "FAILED" | "ABORTED";
  startedAt: string;
};

export function RecordingControls({ roomName }: { roomName: string }) {
  const [active, setActive] = useState<ActiveRecording | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [consentOpen, setConsentOpen] = useState(false);

  const refresh = useCallback(async () => {
    const response = await fetch(
      `/api/meetings/${encodeURIComponent(roomName)}/recording`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as {
      activeRecording: ActiveRecording | null;
      canManage: boolean;
    };
    setActive(payload.activeRecording);
    setCanManage(payload.canManage);
  }, [roomName]);

  useEffect(() => {
    let alive = true;

    async function poll() {
      if (!alive) return;
      try {
        await refresh();
      } catch {
        // Keep polling through transient failures.
      } finally {
        if (alive) window.setTimeout(poll, 4000);
      }
    }

    void poll();
    return () => {
      alive = false;
    };
  }, [refresh]);

  async function runRecordingAction(action: "start" | "stop") {
    setError("");
    setBusy(true);

    try {
      const response = await fetch(
        `/api/meetings/${encodeURIComponent(roomName)}/recording?action=${action}`,
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
      const payload = (await response.json()) as {
        error?: string;
        recording?: ActiveRecording;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Recording belum dapat diproses.");
      }

      setConsentOpen(false);
      await refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Recording belum dapat diproses.",
      );
    } finally {
      setBusy(false);
    }
  }

  function toggleRecording() {
    if (!canManage || busy) {
      return;
    }

    if (active) {
      void runRecordingAction("stop");
      return;
    }

    setConsentOpen(true);
  }

  if (!canManage) {
    return null;
  }

  const isRecording =
    active?.status === "STARTING" ||
    active?.status === "ACTIVE" ||
    active?.status === "ENDING";

  return (
    <>
      <div className="recording-controls">
        <button
          type="button"
          className={isRecording ? "recording-active" : undefined}
          disabled={busy || active?.status === "ENDING"}
          onClick={() => toggleRecording()}
        >
          {busy ? (
            <LoaderCircle className="spin" size={16} />
          ) : isRecording ? (
            <Square size={14} />
          ) : (
            <Circle size={14} />
          )}
          {isRecording
            ? active
              ? recordingStatusLabel(active.status)
              : "Merekam"
            : "Rekam"}
        </button>
        {error ? <p className="recording-error">{error}</p> : null}
      </div>

      <RecordingConsentModal
        open={consentOpen}
        busy={busy}
        onCancel={() => setConsentOpen(false)}
        onConfirm={() => void runRecordingAction("start")}
      />
    </>
  );
}
