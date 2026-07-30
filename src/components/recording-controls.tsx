"use client";

import { useCallback, useEffect, useState } from "react";
import { Circle, LoaderCircle, Square } from "lucide-react";
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

  async function toggleRecording() {
    if (!canManage || busy) {
      return;
    }

    setError("");
    setBusy(true);
    const action = active ? "stop" : "start";

    try {
      const response = await fetch(
        `/api/meetings/${encodeURIComponent(roomName)}/recording?action=${action}`,
        { method: "POST" },
      );
      const payload = (await response.json()) as {
        error?: string;
        recording?: ActiveRecording;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Recording belum dapat diproses.");
      }

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

  if (!canManage) {
    return null;
  }

  const isRecording =
    active?.status === "STARTING" ||
    active?.status === "ACTIVE" ||
    active?.status === "ENDING";

  return (
    <div className="recording-controls">
      <button
        type="button"
        className={isRecording ? "recording-active" : undefined}
        disabled={busy || active?.status === "ENDING"}
        onClick={() => void toggleRecording()}
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
  );
}
