"use client";

import { useEffect, useState } from "react";
import {
  useConnectionState,
  useLocalParticipant,
  useRemoteParticipants,
  useRoomContext,
} from "@livekit/components-react";
import { ConnectionState, Track } from "livekit-client";
import { useBackgroundEffects } from "@/components/background-effects-context";
import {
  getMeetingDebugSessionId,
  getMeetingDebugUi,
  isMeetingDebugEnabled,
  isVbForceFailEnabled,
} from "@/lib/meeting-logger";

/**
 * Debug-only overlay. Enable with:
 * localStorage.setItem("genmeet_meeting_debug", "1")
 * Never shows tokens/secrets.
 */
export function MeetingDebugOverlay({
  sessionReady,
}: {
  sessionReady: boolean;
}) {
  const [enabled, setEnabled] = useState(false);
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const { localParticipant } = useLocalParticipant();
  const remotes = useRemoteParticipants();
  const { effectId } = useBackgroundEffects();
  const [, tick] = useState(0);

  useEffect(() => {
    const read = () => setEnabled(isMeetingDebugEnabled());
    read();
    window.addEventListener("storage", read);
    return () => window.removeEventListener("storage", read);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [enabled]);

  if (!enabled) return null;

  const micPub = localParticipant.getTrackPublication(Track.Source.Microphone);
  const camPub = localParticipant.getTrackPublication(Track.Source.Camera);
  const ui = getMeetingDebugUi();
  const roomLabel =
    connectionState === ConnectionState.Connected
      ? "CONNECTED"
      : connectionState === ConnectionState.Reconnecting
        ? "RECONNECTING"
        : connectionState === ConnectionState.Connecting
          ? "CONNECTING"
          : "DISCONNECTED";

  const bgFromUi = ui.backgroundStatus;
  const bgLabel =
    effectId === "none"
      ? "OFF"
      : bgFromUi === "FAILED"
        ? "FAILED"
        : bgFromUi === "STARTING" || !camPub?.track
          ? "STARTING"
          : "ACTIVE";

  return (
    <aside className="meeting-debug-overlay" aria-label="Meeting debug">
      <strong>GenMeet debug · {getMeetingDebugSessionId()}</strong>
      <dl>
        <div>
          <dt>Room</dt>
          <dd>{roomLabel}</dd>
        </div>
        <div>
          <dt>Network</dt>
          <dd>{roomLabel}</dd>
        </div>
        <div>
          <dt>Session</dt>
          <dd>{sessionReady ? "ready" : "pending"}</dd>
        </div>
        <div>
          <dt>Identity</dt>
          <dd>{localParticipant.identity.slice(0, 20)}…</dd>
        </div>
        <div>
          <dt>Mic</dt>
          <dd>
            {micPub ? "published" : "none"}
            {micPub
              ? ` · ${micPub.isMuted ? "muted" : "unmuted"} · ${localParticipant.isMicrophoneEnabled ? "enabled" : "disabled"}`
              : ""}
          </dd>
        </div>
        <div>
          <dt>Camera</dt>
          <dd>
            {camPub ? "published" : "none"}
            {camPub
              ? ` · ${camPub.isMuted ? "muted" : "unmuted"} · ${localParticipant.isCameraEnabled ? "enabled" : "disabled"}`
              : ""}
          </dd>
        </div>
        <div>
          <dt>Remotes</dt>
          <dd>{remotes.length}</dd>
        </div>
        <div>
          <dt>Audio</dt>
          <dd>
            canPlaybackAudio=
            {room.canPlaybackAudio ? "ALLOWED" : "BLOCKED"}
          </dd>
        </div>
        <div>
          <dt>Background</dt>
          <dd>
            {bgLabel}
            {effectId !== "none" ? ` · ${effectId}` : ""}
            {isVbForceFailEnabled() ? " · forceFail" : ""}
          </dd>
        </div>
      </dl>
    </aside>
  );
}
