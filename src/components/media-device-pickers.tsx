"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ensureMediaPermission,
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
   * Prejoin already opens the camera for preview — requesting video again
   * races getUserMedia and often leaves the preview black on Windows.
   */
  requestVideoPermission?: boolean;
  onDeviceChange?: (kind: DeviceKind, deviceId: string) => void | Promise<void>;
};

export function MediaDevicePickers({
  showSpeaker = true,
  className,
  requestVideoPermission = true,
  onDeviceChange,
}: MediaDevicePickersProps) {
  const stored = readStoredMediaDevices();
  const [mics, setMics] = useState<MediaDeviceOption[]>([]);
  const [cameras, setCameras] = useState<MediaDeviceOption[]>([]);
  const [speakers, setSpeakers] = useState<MediaDeviceOption[]>([]);
  const [micId, setMicId] = useState(stored.audioinput ?? "");
  const [camId, setCamId] = useState(stored.videoinput ?? "");
  const [speakerId, setSpeakerId] = useState(stored.audiooutput ?? "");
  const permissionAskedRef = useRef(false);
  const onDeviceChangeRef = useRef(onDeviceChange);
  onDeviceChangeRef.current = onDeviceChange;

  const enumerateOnly = useCallback(async () => {
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

    setMicId(nextMic);
    setCamId(nextCam);
    setSpeakerId(nextSpeaker);

    if (nextMic) storeMediaDevice("audioinput", nextMic);
    if (nextCam) storeMediaDevice("videoinput", nextCam);
    if (nextSpeaker) storeMediaDevice("audiooutput", nextSpeaker);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let debounceTimer: number | undefined;

    async function initialLoad() {
      // Ask permission at most once. Never call getUserMedia from devicechange —
      // stopping those tracks fires devicechange again and freezes Firefox.
      if (!permissionAskedRef.current) {
        permissionAskedRef.current = true;
        await ensureMediaPermission({
          audio: true,
          video: requestVideoPermission,
        });
      }
      if (cancelled) return;
      await enumerateOnly();
    }

    void initialLoad();

    // Prejoin opens the camera separately; labels/deviceIds often appear a
    // moment later. Re-enumerate without getUserMedia.
    const retryTimer = window.setTimeout(() => {
      if (!cancelled) void enumerateOnly();
    }, 900);

    const devices = navigator.mediaDevices;
    const onChange = () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        if (!cancelled) void enumerateOnly();
      }, 400);
    };
    devices?.addEventListener?.("devicechange", onChange);

    return () => {
      cancelled = true;
      window.clearTimeout(retryTimer);
      window.clearTimeout(debounceTimer);
      devices?.removeEventListener?.("devicechange", onChange);
    };
  }, [enumerateOnly, requestVideoPermission]);

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
