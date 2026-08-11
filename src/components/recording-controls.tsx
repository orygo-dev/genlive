"use client";

import { useCallback, useEffect, useState } from "react";
import { Circle, LoaderCircle, Square } from "lucide-react";
import { RecordingConsentModal } from "@/components/recording-consent-modal";
import { recordingStatusLabel } from "@/lib/recording-helpers";

type ActiveRecording = {
  id: string;
  status: "STARTING" | "ACTIVE" | "ENDING" | "COMPLETE" | "FAILED" | "ABORTED";
  startedAt: string;
  egressId?: string;
};

type RecordingUiState =
  | "IDLE"
  | "STARTING"
  | "RECORDING"
  | "STOPPING"
  | "FAILED";

function toUiState(
  active: ActiveRecording | null,
  busyAction: "start" | "stop" | null,
): RecordingUiState {
  if (busyAction === "start") return "STARTING";
  if (busyAction === "stop") return "STOPPING";
  if (!active) return "IDLE";
  if (active.status === "STARTING") return "STARTING";
  if (active.status === "ACTIVE") return "RECORDING";
  if (active.status === "ENDING") return "STOPPING";
  if (active.status === "FAILED" || active.status === "ABORTED") return "FAILED";
  return "IDLE";
}

export function RecordingControls({ roomName }: { roomName: string }) {
  const [active, setActive] = useState<ActiveRecording | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [egressConfigured, setEgressConfigured] = useState(true);
  const [busyAction, setBusyAction] = useState<"start" | "stop" | null>(null);
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
      egressConfigured?: boolean;
    };
    setActive(payload.activeRecording);
    setCanManage(payload.canManage);
    if (typeof payload.egressConfigured === "boolean") {
      setEgressConfigured(payload.egressConfigured);
    }
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
    setBusyAction(action);

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
        reused?: boolean;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Recording belum dapat diproses.");
      }

      if (action === "start") {
        if (!payload.recording?.id) {
          throw new Error("Backend tidak mengembalikan recording yang valid.");
        }
        // Only treat as success when we have a DB recording row back.
        setActive(payload.recording);
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
      setBusyAction(null);
    }
  }

  function toggleRecording() {
    if (!canManage || busyAction) {
      return;
    }

    if (active && (active.status === "STARTING" || active.status === "ACTIVE" || active.status === "ENDING")) {
      void runRecordingAction("stop");
      return;
    }

    if (!egressConfigured) {
      setError(
        "Storage Egress S3 belum dikonfigurasi. Super Admin → Integrasi → isi LIVEKIT_EGRESS_S3_*.",
      );
      return;
    }

    setConsentOpen(true);
  }

  if (!canManage) {
    return null;
  }

  const ui = toUiState(active, busyAction);
  const isBusy = ui === "STARTING" || ui === "STOPPING";

  let label = "Rekam";
  if (ui === "STARTING") label = "Starting...";
  else if (ui === "STOPPING") label = "Mengakhiri...";
  else if (ui === "RECORDING") label = recordingStatusLabel("ACTIVE");
  else if (ui === "FAILED") label = "Gagal — coba lagi";

  return (
    <>
      <div className="recording-controls">
        <button
          type="button"
          className={ui === "RECORDING" || ui === "STARTING" ? "recording-active" : undefined}
          disabled={isBusy}
          onClick={() => toggleRecording()}
          title={
            !egressConfigured
              ? "Konfigurasi S3 Egress terlebih dahulu"
              : undefined
          }
        >
          {isBusy ? (
            <LoaderCircle className="spin" size={16} />
          ) : ui === "RECORDING" ? (
            <Square size={14} />
          ) : (
            <Circle size={14} />
          )}
          {label}
        </button>
        {error ? <p className="recording-error">{error}</p> : null}
        {!egressConfigured && !error ? (
          <p className="recording-error">
            Egress S3 belum siap — recording tidak bisa dimulai.
          </p>
        ) : null}
      </div>

      <RecordingConsentModal
        open={consentOpen}
        busy={busyAction === "start"}
        onCancel={() => setConsentOpen(false)}
        onConfirm={() => void runRecordingAction("start")}
      />
    </>
  );
}
