/**
 * Structured meeting observability — no tokens/secrets/PII payloads.
 * Enable verbose mode with localStorage.setItem("genmeet_meeting_debug", "1").
 *
 * Debug session ID is logging-only — never used as LiveKit participant identity.
 */

import { ConnectionState, DisconnectReason } from "livekit-client";

export type MeetingLogEvent =
  | "ROOM_CONNECTING"
  | "ROOM_CONNECTED"
  | "ROOM_RECONNECTING"
  | "ROOM_RECONNECTED"
  | "ROOM_DISCONNECTED"
  | "PARTICIPANT_CONNECTED"
  | "PARTICIPANT_DISCONNECTED"
  | "TRACK_PUBLISHED"
  | "TRACK_UNPUBLISHED"
  | "TRACK_SUBSCRIBED"
  | "TRACK_UNSUBSCRIBED"
  | "TRACK_MUTED"
  | "TRACK_UNMUTED"
  | "MIC_ENABLED"
  | "MIC_DISABLED"
  | "CAMERA_ENABLED"
  | "CAMERA_DISABLED"
  | "AUDIO_PLAYBACK_BLOCKED"
  | "AUDIO_PLAYBACK_STARTED"
  | "CHAT_SEND"
  | "CHAT_RECEIVED"
  | "CHAT_ERROR"
  | "BACKGROUND_PROCESSOR_START"
  | "BACKGROUND_PROCESSOR_STOP"
  | "BACKGROUND_PROCESSOR_ERROR"
  | "SESSION_READY"
  | "SESSION_UI_RESTORED"
  | "INVARIANT_WARN";

type MeetingLogData = Record<string, string | number | boolean | null | undefined>;

const SENSITIVE_KEY =
  /token|secret|password|authorization|cookie|jwt|credential/i;

/** App UI flags shared with the debug overlay (not LiveKit SoT). */
export type MeetingDebugUiSnapshot = {
  sessionReady: boolean;
  backgroundStatus: "OFF" | "STARTING" | "ACTIVE" | "FAILED";
  backgroundError?: string;
};

let meetingDebugSessionId: string | null = null;
let debugUi: MeetingDebugUiSnapshot = {
  sessionReady: false,
  backgroundStatus: "OFF",
};
let lastConnectionState: ConnectionState | null = null;

export function ensureMeetingDebugSessionId(): string {
  if (meetingDebugSessionId) return meetingDebugSessionId;
  const bytes =
    typeof crypto !== "undefined" && "getRandomValues" in crypto
      ? crypto.getRandomValues(new Uint8Array(4))
      : new Uint8Array([
          Math.floor(Math.random() * 256),
          Math.floor(Math.random() * 256),
          Math.floor(Math.random() * 256),
          Math.floor(Math.random() * 256),
        ]);
  meetingDebugSessionId = Array.from(bytes, (b) =>
    b.toString(16).padStart(2, "0"),
  )
    .join("")
    .toUpperCase();
  return meetingDebugSessionId;
}

export function getMeetingDebugSessionId(): string {
  return ensureMeetingDebugSessionId();
}

export function setMeetingDebugUi(patch: Partial<MeetingDebugUiSnapshot>) {
  debugUi = { ...debugUi, ...patch };
}

export function getMeetingDebugUi(): MeetingDebugUiSnapshot {
  return debugUi;
}

export function setMeetingDebugConnectionState(state: ConnectionState) {
  lastConnectionState = state;
}

export function getMeetingDebugConnectionState(): ConnectionState | null {
  return lastConnectionState;
}

export function isMeetingDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem("genmeet_meeting_debug") === "1";
  } catch {
    return false;
  }
}

/** DEV-ONLY: force VB fail-safe path. */
export function isVbForceFailEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem("genmeet_vb_force_fail") === "1";
  } catch {
    return false;
  }
}

/**
 * Map LiveKit DisconnectReason enum → stable label for logs.
 * Uses enum reverse mapping — no string guessing on free-form messages.
 */
export function formatDisconnectReason(
  reason?: DisconnectReason | null,
): string {
  if (reason == null) return "UNKNOWN";
  const name = DisconnectReason[reason];
  if (typeof name === "string" && name.length > 0) {
    return name;
  }
  return "UNKNOWN";
}

function formatClock(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

function sanitize(data?: MeetingLogData): MeetingLogData | undefined {
  if (!data) return undefined;
  const out: MeetingLogData = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEY.test(key)) continue;
    if (typeof value === "string" && value.length > 200) {
      out[key] = `${value.slice(0, 40)}…(len=${value.length})`;
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function meetingLogger(
  event: MeetingLogEvent,
  data?: MeetingLogData,
): void {
  const ts = Date.now();
  const sid = ensureMeetingDebugSessionId();
  const connectionState =
    lastConnectionState != null
      ? String(lastConnectionState)
      : undefined;

  const payload = {
    scope: "meeting",
    event,
    t: ts,
    clock: formatClock(ts),
    debugSessionId: sid,
    connectionState,
    ...sanitize(data),
  };

  const always =
    event.startsWith("ROOM_") ||
    event.startsWith("AUDIO_") ||
    event.startsWith("BACKGROUND_") ||
    event.startsWith("SESSION_") ||
    event.startsWith("CHAT_ERROR") ||
    event === "INVARIANT_WARN";

  if (!always && !isMeetingDebugEnabled()) return;

  const prefix = `[GENMEET][${sid}]`;
  if (event.includes("ERROR") || event === "ROOM_DISCONNECTED" || event === "INVARIANT_WARN") {
    console.warn(prefix, formatClock(ts), event, payload);
  } else if (isMeetingDebugEnabled() || always) {
    console.info(prefix, formatClock(ts), event, payload);
  }
}
