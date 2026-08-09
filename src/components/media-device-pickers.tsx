"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  listMediaDevices,
  pickPreferredDeviceId,
  readStoredMediaDevices,
  storeMediaDevice,
  type MediaDeviceOption,
} from "@/lib/media-devices";

type DeviceKind = "audioinput" | "videoinput" | "audiooutput";

type MediaDevicePickersProps = {
  showSpeaker?: boolean;
  className?: string;
  /**
   * Prejoin already owns the camera via createLocalVideoTrack.
   * Never probe getUserMedia here — GUM+stop fires devicechange and can
   * freeze Firefox in a loop with the live preview track.
   */
  requestVideoPermission?: boolean;
  /** When true, only enumerateDevices — no permission probe at all. */
  enumerateOnly?: boolean;
  /** Bump after prejoin grants media permission to re-read device lists. */
  refreshRevision?: number;
  onDeviceChange?: (kind: DeviceKind, deviceId: string) => void | Promise<void>;
};

export function MediaDevicePickers({
  showSpeaker = true,
  className,
  requestVideoPermission = true,
  enumerateOnly = false,
  refreshRevision = 0,
  onDeviceChange,
}: MediaDevicePickersProps) {
  const stored = readStoredMediaDevices();
  const [mics, setMics] = useState<MediaDeviceOption[]>([]);
  const [cameras, setCameras] = useState<MediaDeviceOption[]>([]);
  const [speakers, setSpeakers] = useState<MediaDeviceOption[]>([]);
  const [micId, setMicId] = useState(stored.audioinput ?? "");
  const [camId, setCamId] = useState(stored.videoinput ?? "");
  const [speakerId, setSpeakerId] = useState(stored.audiooutput ?? "");
  const onDeviceChangeRef = useRef(onDeviceChange);
  onDeviceChangeRef.current = onDeviceChange;

  const refreshDevices = useCallback(async () => {
    const [nextMics, nextCams, nextSpeakers] = await Promise.all([
      listMediaDevices("audioinput"),
      listMediaDevices("videoinput"),
      listMediaDevices("audiooutput"),
    ]);
    setMics(nextMics);
    setCameras(nextCams);
    setSpeakers(nextSpeakers);

    const preferred = readStoredMediaDevices();
    const nextMic = pickPreferredDeviceId(nextMics, preferred.audioinput);
    const nextCam = pickPreferredDeviceId(nextCams, preferred.videoinput);
    const nextSpeaker = pickPreferredDeviceId(
      nextSpeakers,
      preferred.audiooutput,
    );

    setMicId((current) => nextMic || current);
    setCamId((current) => nextCam || current);
    setSpeakerId((current) => nextSpeaker || current);

    if (nextMic) storeMediaDevice("audioinput", nextMic);
    if (nextCam) storeMediaDevice("videoinput", nextCam);
    if (nextSpeaker) storeMediaDevice("audiooutput", nextSpeaker);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let debounceTimer: number | undefined;

    async function boot() {
      // Intentionally never call getUserMedia+stop while a LiveKit preview
      // may be live. Enumeration is enough after the preview grants access.
      if (!enumerateOnly && requestVideoPermission) {
        // In-room / settings only: soft permission via Permissions API if available.
        try {
          const perms = navigator.permissions;
          if (perms?.query) {
            await Promise.allSettled([
              perms.query({ name: "microphone" as PermissionName }),
              perms.query({ name: "camera" as PermissionName }),
            ]);
          }
        } catch {
          // ignore
        }
      }
      if (cancelled) return;
      await refreshDevices();
    }

    void boot();

    // Labels often appear after the prejoin camera track is live.
    const retries = [400, 1200, 2500].map((ms) =>
      window.setTimeout(() => {
        if (!cancelled) void refreshDevices();
      }, ms),
    );

    const devices = navigator.mediaDevices;
    const onChange = () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        if (!cancelled) void refreshDevices();
      }, 500);
    };
    devices?.addEventListener?.("devicechange", onChange);

    return () => {
      cancelled = true;
      for (const timer of retries) window.clearTimeout(timer);
      window.clearTimeout(debounceTimer);
      devices?.removeEventListener?.("devicechange", onChange);
    };
  }, [enumerateOnly, refreshDevices, refreshRevision, requestVideoPermission]);

  async function changeDevice(kind: DeviceKind, deviceId: string) {
    if (!deviceId) return;
    if (kind === "audioinput") setMicId(deviceId);
    if (kind === "videoinput") setCamId(deviceId);
    if (kind === "audiooutput") setSpeakerId(deviceId);
    storeMediaDevice(kind, deviceId);
    await onDeviceChangeRef.current?.(kind, deviceId);
  }

  return (
    <div className={className ?? "meeting-device-pickers"}>
      <div className="meeting-tools-field">
        <label htmlFor="device-mic">Mikrofon</label>
        <select
          id="device-mic"
          value={micId}
          onChange={(event) => void changeDevice("audioinput", event.target.value)}
        >
          {mics.length === 0 ? (
            <option value="">Tidak ada mikrofon</option>
          ) : (
            mics.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))
          )}
        </select>
      </div>
      <div className="meeting-tools-field">
        <label htmlFor="device-cam">Kamera</label>
        <select
          id="device-cam"
          value={camId}
          onChange={(event) =>
            void changeDevice("videoinput", event.target.value)
          }
        >
          {cameras.length === 0 ? (
            <option value="">Tidak ada kamera</option>
          ) : (
            cameras.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))
          )}
        </select>
      </div>
      {showSpeaker ? (
        <div className="meeting-tools-field">
          <label htmlFor="device-speaker">Speaker</label>
          <select
            id="device-speaker"
            value={speakerId}
            onChange={(event) =>
              void changeDevice("audiooutput", event.target.value)
            }
          >
            {speakers.length === 0 ? (
              <option value="">Default sistem</option>
            ) : (
              speakers.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>
              ))
            )}
          </select>
        </div>
      ) : null}
    </div>
  );
}
