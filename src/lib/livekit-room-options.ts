import {
  AudioPresets,
  DefaultReconnectPolicy,
  ScreenSharePresets,
  VideoPresets,
  type AudioCaptureOptions,
  type RoomConnectOptions,
  type RoomOptions,
  type VideoCaptureOptions,
} from "livekit-client";
import { readStoredMediaDevices } from "@/lib/media-devices";

/** Longer reconnect window for unstable mobile / Wi‑Fi links. */
const RECONNECT_DELAYS_MS = [
  0, 300, 800, 1500, 2500, 4000, 6000, 8000, 12000, 18000, 25000, 30000,
];

export function buildMeetingRoomOptions(): RoomOptions {
  const devices = readStoredMediaDevices();
  return {
    adaptiveStream: {
      pixelDensity: "screen",
    },
    dynacast: true,
    disconnectOnPageLeave: true,
    stopLocalTrackOnUnpublish: true,
    reconnectPolicy: new DefaultReconnectPolicy(RECONNECT_DELAYS_MS),
    audioCaptureDefaults: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      voiceIsolation: true,
      ...(devices.audioinput ? { deviceId: devices.audioinput } : {}),
    },
    videoCaptureDefaults: {
      facingMode: "user",
      resolution: VideoPresets.h720.resolution,
      ...(devices.videoinput ? { deviceId: devices.videoinput } : {}),
    },
    audioOutput: devices.audiooutput
      ? { deviceId: devices.audiooutput }
      : undefined,
    publishDefaults: {
      audioPreset: AudioPresets.speech,
      dtx: true,
      red: true,
      forceStereo: false,
      simulcast: true,
      videoCodec: "vp8",
      backupCodec: true,
      videoEncoding: VideoPresets.h720.encoding,
      videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360],
      screenShareEncoding: ScreenSharePresets.h1080fps15.encoding,
      degradationPreference: "maintain-framerate",
      stopMicTrackOnMute: false,
    },
  };
}

export function buildMeetingConnectOptions(): RoomConnectOptions {
  return {
    autoSubscribe: true,
    maxRetries: 3,
    peerConnectionTimeout: 25_000,
    websocketTimeout: 20_000,
  };
}

export function buildLocalAudioCapture(
  enabled: boolean,
): AudioCaptureOptions | false {
  if (!enabled) return false;
  const devices = readStoredMediaDevices();
  return {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    ...(devices.audioinput ? { deviceId: devices.audioinput } : {}),
  };
}

export function buildLocalVideoCapture(
  enabled: boolean,
): VideoCaptureOptions | false {
  if (!enabled) return false;
  const devices = readStoredMediaDevices();
  return {
    facingMode: "user",
    resolution: VideoPresets.h720.resolution,
    ...(devices.videoinput ? { deviceId: devices.videoinput } : {}),
  };
}
