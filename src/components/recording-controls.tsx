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

const START_TIMEOUT_MS = 55_000;
const STOP_TIMEOUT_MS = 30_000;

function toUiState(
  active: ActiveRecording | null,
  busyAction: "start" | "stop" | null,
): RecordingUiState {
  // Only the in-flight request locks the UI to STARTING/STOPPING.
  // LiveKit often returns EGRESS_STARTING; that must still be stoppable.
  if (busyAction === "start") return "STARTING";
  if (busyAction === "stop") return "STOPPING";
  if (!active) return "IDLE";
  if (active.status === "ENDING") return "STOPPING";
  if (active.status === "FAILED" || active.status === "ABORTED") return "FAILED";
  // STARTING with a real egress id (or any open row after API success) = recording.
  if (active.status === "STARTING" || active.status === "ACTIVE") {
    return active.egressId || active.status === "ACTIVE" ? "RECORDING" : "STARTING";
  }
  return "IDLE";
}

function elapsedLabel(startedAt: string) {
  const started = Date.parse(startedAt);
  if (!Number.isFinite(started)) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - started) / 1000));
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function RecordingControls({ roomName }: { roomName: string }) {
  const [active, setActive] = useState<ActiveRecording | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [egressConfigured, setEgressConfigured] = useState(true);
  const [busyAction, setBusyAction] = useState<"start" | "stop" | null>(null);
  const [error, setError] = useState("");
  const [consentOpen, setConsentOpen] = useState(false);
  const [, setTick] = useState(0);

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
    let timer: number | undefined;

    async function poll() {
      if (!alive) return;
      try {
        await refresh();
      } catch {
        // Keep polling through transient failures.
      } finally {
        if (alive) timer = window.setTimeout(poll, 2000);
      }
    }

    void poll();
    return () => {
      alive = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [refresh]);

  useEffect(() => {
    if (!active || (active.status !== "ACTIVE" && active.status !== "STARTING")) {
      return;
    }
    const id = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, [active]);

  async function runRecordingAction(action: "start" | "stop") {
    setError("");
    setBusyAction(action);
    const controller = new AbortController();
    const timeoutMs = action === "start" ? START_TIMEOUT_MS : STOP_TIMEOUT_MS;
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

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
          signal: controller.signal,
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
        setActive(payload.recording);
      } else if (payload.recording) {
        if (
          payload.recording.status === "COMPLETE" ||
          payload.recording.status === "FAILED" ||
          payload.recording.status === "ABORTED" ||
          payload.recording.status === "ENDING"
        ) {
          setActive(
            payload.recording.status === "ENDING" ? payload.recording : null,
          );
        } else {
          setActive(payload.recording);
        }
      }

      setConsentOpen(false);
      await refresh();
    } catch (requestError) {
      const aborted =
        requestError instanceof DOMException && requestError.name === "AbortError";
      setError(
        aborted
          ? action === "start"
            ? "Timeout memulai recording. Cek LiveKit/S3 atau coba Stop lalu Start lagi."
            : "Timeout menghentikan recording. Coba lagi."
          : requestError instanceof Error
            ? requestError.message
            : "Recording belum dapat diproses.",
      );
      await refresh().catch(() => undefined);
    } finally {
      window.clearTimeout(timeoutId);
      setBusyAction(null);
    }
  }

  function toggleRecording() {
    if (!canManage || busyAction) {
      return;
    }

    if (
      active &&
      (active.status === "STARTING" ||
        active.status === "ACTIVE" ||
        active.status === "ENDING")
    ) {
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
  // Only disable while the HTTP request is in flight — never lock on STARTING forever.
  const isRequestBusy = busyAction !== null;
  const canStop =
    !isRequestBusy &&
    active &&
    (active.status === "STARTING" ||
      active.status === "ACTIVE" ||
      active.status === "ENDING");

  let label = "Rekam";
  if (busyAction === "start") label = "Starting...";
  else if (busyAction === "stop" || ui === "STOPPING") label = "Mengakhiri...";
  else if (ui === "RECORDING" || (active && active.status === "STARTING")) {
    const timer = active ? elapsedLabel(active.startedAt) : "";
    const statusLabel = recordingStatusLabel(
      active?.status === "ACTIVE" ? "ACTIVE" : "STARTING",
    );
    label = timer ? `${statusLabel} ${timer}` : statusLabel;
  } else if (ui === "FAILED") label = "Gagal — coba lagi";

  return (
    <>
      <div className="recording-controls">
        <button
          type="button"
          className={
            ui === "RECORDING" ||
            active?.status === "STARTING" ||
            busyAction === "start"
              ? "recording-active"
              : undefined
          }
          disabled={isRequestBusy}
          onClick={() => toggleRecording()}
          title={
            !egressConfigured
              ? "Konfigurasi S3 Egress terlebih dahulu"
              : canStop
                ? "Klik untuk stop recording"
                : undefined
          }
        >
          {isRequestBusy ? (
            <LoaderCircle className="spin" size={16} />
          ) : canStop ? (
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
