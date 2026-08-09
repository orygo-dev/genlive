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
import {
  idealDeviceId,
  listMediaDevices,
  pickPreferredDeviceId,
  readStoredMediaDevices,
  storeMediaDevice,
} from "@/lib/media-devices";

/** Longer reconnect window for unstable mobile / Wi‑Fi links. */
const RECONNECT_DELAYS_MS = [
  0, 300, 800, 1500, 2500, 4000, 6000, 8000, 12000, 18000, 25000, 30000,
];

export function buildMeetingRoomOptions(): RoomOptions {
  const devices = readStoredMediaDevices();
  const videoDevice = idealDeviceId(devices.videoinput);
  const audioDevice = idealDeviceId(devices.audioinput);

  return {
    adaptiveStream: true,
    dynacast: true,
    disconnectOnPageLeave: true,
    stopLocalTrackOnUnpublish: true,
    reconnectPolicy: new DefaultReconnectPolicy(RECONNECT_DELAYS_MS),
    audioCaptureDefaults: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      ...(audioDevice ? { deviceId: audioDevice } : {}),
    },
    videoCaptureDefaults: {
      // Prefer a real stored deviceId. Avoid facingMode on desktop — Firefox
      // often throws NotFoundError when no device exposes facingMode.
      ...(videoDevice ? { deviceId: videoDevice } : {}),
      resolution: VideoPresets.h720.resolution,
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
  const audioDevice = idealDeviceId(devices.audioinput);
  return {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    ...(audioDevice ? { deviceId: audioDevice } : {}),
  };
}

/**
 * Sync capture options for callers that cannot await.
 * Prefer {@link resolveLocalVideoCapture} before setCameraEnabled — LiveKit
 * injects deviceId:"default" when deviceId is omitted, which breaks Firefox.
 */
export function buildLocalVideoCapture(
  enabled: boolean,
): VideoCaptureOptions | false {
  if (!enabled) return false;
  const devices = readStoredMediaDevices();
  const videoDevice = idealDeviceId(devices.videoinput);
  return {
    ...(videoDevice ? { deviceId: videoDevice } : {}),
    resolution: VideoPresets.h720.resolution,
  };
}

/**
 * Resolve a real camera deviceId before enabling the LiveKit camera.
 * Never pass deviceId:"default" / facingMode:"user" alone — both cause
 * NotFoundError on many desktop Firefox setups.
 */
export async function resolveLocalVideoCapture(): Promise<VideoCaptureOptions> {
  const stored = readStoredMediaDevices().videoinput;
  let cams = await listMediaDevices("videoinput");

  // Firefox often lists zero cameras until getUserMedia has run once.
  if (cams.length === 0 && navigator.mediaDevices?.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      for (const track of stream.getTracks()) track.stop();
      cams = await listMediaDevices("videoinput");
    } catch {
      // keep empty — caller handles NotFoundError
    }
  }

  const preferred = pickPreferredDeviceId(cams, stored);
  if (preferred) {
    storeMediaDevice("videoinput", preferred);
  }

  return {
    ...(preferred ? { deviceId: { exact: preferred } } : {}),
    resolution: VideoPresets.h720.resolution,
  };
}
