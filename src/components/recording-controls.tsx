"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
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

type RecordingApiPayload = {
  error?: string;
  recording?: ActiveRecording;
  activeRecording?: ActiveRecording | null;
  canManage?: boolean;
  egressConfigured?: boolean;
  reused?: boolean;
};

const START_TIMEOUT_MS = 55_000;
const STOP_TIMEOUT_MS = 45_000;

async function readRecordingJson(
  response: Response,
  actionLabel: string,
): Promise<RecordingApiPayload> {
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(text) as RecordingApiPayload;
    } catch {
      throw new Error(
        `${actionLabel}: respons JSON tidak valid (status ${response.status}).`,
      );
    }
  }

  if (response.status === 502 || response.status === 503 || response.status === 504) {
    throw new Error(
      `${actionLabel}: server/proxy timeout (${response.status}). Untuk Start recording, naikkan ProxyTimeout Apache (atau proxy_read_timeout Nginx) ke ≥120s.`,
    );
  }

  if (response.status === 404) {
    throw new Error(
      `${actionLabel}: endpoint tidak ditemukan (404). Deploy ulang dengan bash scripts/aapanel-pm2.sh --build.`,
    );
  }

  const snippet = text.replace(/\s+/g, " ").trim().slice(0, 120);
  throw new Error(
    `${actionLabel}: server mengembalikan non-JSON (status ${response.status})${
      snippet ? `: ${snippet}` : "."
    }`,
  );
}

function toUiState(
  active: ActiveRecording | null,
  busyAction: "start" | "stop" | null,
): RecordingUiState {
  if (busyAction === "start") return "STARTING";
  if (busyAction === "stop") return "STOPPING";
  if (!active) return "IDLE";
  if (active.status === "ENDING") return "STOPPING";
  if (active.status === "FAILED" || active.status === "ABORTED") return "FAILED";
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

function isOpenStatus(status: ActiveRecording["status"]) {
  return status === "STARTING" || status === "ACTIVE" || status === "ENDING";
}

export function RecordingControls({ roomName }: { roomName: string }) {
  const [active, setActive] = useState<ActiveRecording | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [egressConfigured, setEgressConfigured] = useState(true);
  const [busyAction, setBusyAction] = useState<"start" | "stop" | null>(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [consentOpen, setConsentOpen] = useState(false);
  const [, setTick] = useState(0);

  const refresh = useCallback(async () => {
    const response = await fetch(
      `/api/meetings/${encodeURIComponent(roomName)}/recording`,
      { cache: "no-store" },
    );
    try {
      const payload = await readRecordingJson(response, "Status recording");
      if (!response.ok) {
        return null;
      }
      const next = payload.activeRecording ?? null;
      setActive(next);
      setCanManage(Boolean(payload.canManage));
      if (typeof payload.egressConfigured === "boolean") {
        setEgressConfigured(payload.egressConfigured);
      }
      return next;
    } catch {
      return null;
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
    if (action === "stop") {
      setInfo("");
    }
    setBusyAction(action);
    const controller = new AbortController();
    const timeoutMs = action === "start" ? START_TIMEOUT_MS : STOP_TIMEOUT_MS;
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
    const actionLabel = action === "start" ? "Start recording" : "Stop recording";

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
      const payload = await readRecordingJson(response, actionLabel);

      if (!response.ok) {
        throw new Error(payload.error ?? "Recording belum dapat diproses.");
      }

      if (action === "start") {
        if (!payload.recording?.id) {
          throw new Error("Backend tidak mengembalikan recording yang valid.");
        }
        setActive(payload.recording);
        setConsentOpen(false);
        await refresh();
      } else {
        // One-click stop: never require a second StopEgress.
        setConsentOpen(false);
        let current = payload.recording ?? null;
        if (!current || current.status === "COMPLETE" || current.status === "FAILED" || current.status === "ABORTED") {
          setActive(null);
        } else {
          setActive(current);
        }

        for (let i = 0; i < 25; i += 1) {
          if (!current || !isOpenStatus(current.status)) {
            break;
          }
          await new Promise((resolve) => window.setTimeout(resolve, 800));
          current = await refresh();
        }

        if (!current || !isOpenStatus(current.status)) {
          setActive(null);
          setInfo(
            "Recording dihentikan. Hasil ada di Dashboard → Recording.",
          );
        } else {
          setInfo(
            "Stop sudah dikirim. File masih diproses — cek Dashboard → Recording.",
          );
        }
      }
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

    // Already stopping — refresh only; do not send a second StopEgress.
    if (active?.status === "ENDING") {
      void refresh();
      return;
    }

    if (active && (active.status === "STARTING" || active.status === "ACTIVE")) {
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
  const isRequestBusy = busyAction !== null;
  const canStop =
    !isRequestBusy &&
    active &&
    (active.status === "STARTING" || active.status === "ACTIVE");

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
          disabled={isRequestBusy || active?.status === "ENDING"}
          onClick={() => toggleRecording()}
          title={
            !egressConfigured
              ? "Konfigurasi S3 Egress terlebih dahulu"
              : canStop
                ? "Klik untuk stop recording"
                : active?.status === "ENDING"
                  ? "Sedang mengakhiri recording"
                  : undefined
          }
        >
          {isRequestBusy || active?.status === "ENDING" ? (
            <LoaderCircle className="spin" size={16} />
          ) : canStop ? (
            <Square size={14} />
          ) : (
            <Circle size={14} />
          )}
          {label}
        </button>
        {error ? <p className="recording-error">{error}</p> : null}
        {info && !error ? (
          <p className="recording-info">
            {info}{" "}
            <Link href="/dashboard/recordings" target="_blank" rel="noreferrer">
              Buka Recording
            </Link>
          </p>
        ) : null}
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
