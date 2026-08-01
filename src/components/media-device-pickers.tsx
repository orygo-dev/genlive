"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ensureMediaPermission,
  listMediaDevices,
  readStoredMediaDevices,
  storeMediaDevice,
  type MediaDeviceOption,
} from "@/lib/media-devices";

type DeviceKind = "audioinput" | "videoinput" | "audiooutput";

type MediaDevicePickersProps = {
  showSpeaker?: boolean;
  className?: string;
  onDeviceChange?: (kind: DeviceKind, deviceId: string) => void | Promise<void>;
};

export function MediaDevicePickers({
  showSpeaker = true,
  className,
  onDeviceChange,
}: MediaDevicePickersProps) {
  const stored = readStoredMediaDevices();
  const [mics, setMics] = useState<MediaDeviceOption[]>([]);
  const [cameras, setCameras] = useState<MediaDeviceOption[]>([]);
  const [speakers, setSpeakers] = useState<MediaDeviceOption[]>([]);
  const [micId, setMicId] = useState(stored.audioinput ?? "");
  const [camId, setCamId] = useState(stored.videoinput ?? "");
  const [speakerId, setSpeakerId] = useState(stored.audiooutput ?? "");

  const refresh = useCallback(async () => {
    await ensureMediaPermission();
    const [nextMics, nextCams, nextSpeakers] = await Promise.all([
      listMediaDevices("audioinput"),
      listMediaDevices("videoinput"),
      listMediaDevices("audiooutput"),
    ]);
    setMics(nextMics);
    setCameras(nextCams);
    setSpeakers(nextSpeakers);

    const preferred = readStoredMediaDevices();
    const nextMic =
      preferred.audioinput &&
      nextMics.some((d) => d.deviceId === preferred.audioinput)
        ? preferred.audioinput
        : nextMics[0]?.deviceId ?? "";
    const nextCam =
      preferred.videoinput &&
      nextCams.some((d) => d.deviceId === preferred.videoinput)
        ? preferred.videoinput
        : nextCams[0]?.deviceId ?? "";
    const nextSpeaker =
      preferred.audiooutput &&
      nextSpeakers.some((d) => d.deviceId === preferred.audiooutput)
        ? preferred.audiooutput
        : nextSpeakers[0]?.deviceId ?? "";

    setMicId(nextMic);
    setCamId(nextCam);
    setSpeakerId(nextSpeaker);
  }, []);

  useEffect(() => {
    void refresh();
    const devices = navigator.mediaDevices;
    if (!devices?.addEventListener) return;
    const onChange = () => {
      void refresh();
    };
    devices.addEventListener("devicechange", onChange);
    return () => devices.removeEventListener("devicechange", onChange);
  }, [refresh]);

  async function changeDevice(kind: DeviceKind, deviceId: string) {
    if (!deviceId) return;
    if (kind === "audioinput") setMicId(deviceId);
    if (kind === "videoinput") setCamId(deviceId);
    if (kind === "audiooutput") setSpeakerId(deviceId);
    storeMediaDevice(kind, deviceId);
    await onDeviceChange?.(kind, deviceId);
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
