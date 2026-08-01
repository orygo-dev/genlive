export type MediaDeviceOption = {
  deviceId: string;
  label: string;
};

export type MediaDeviceSelections = {
  audioinput: string;
  videoinput: string;
  audiooutput: string;
};

const DEVICE_STORAGE_KEY = "genmeet_media_devices";

export function readStoredMediaDevices(): Partial<MediaDeviceSelections> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(DEVICE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<MediaDeviceSelections>;
    return {
      audioinput:
        typeof parsed.audioinput === "string" ? parsed.audioinput : undefined,
      videoinput:
        typeof parsed.videoinput === "string" ? parsed.videoinput : undefined,
      audiooutput:
        typeof parsed.audiooutput === "string" ? parsed.audiooutput : undefined,
    };
  } catch {
    return {};
  }
}

export function storeMediaDevice(
  kind: keyof MediaDeviceSelections,
  deviceId: string,
) {
  if (typeof window === "undefined") return;
  try {
    const current = readStoredMediaDevices();
    const next = { ...current, [kind]: deviceId };
    window.sessionStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore quota / private mode.
  }
}

export async function listMediaDevices(kind: MediaDeviceKind): Promise<MediaDeviceOption[]> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
    return [];
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((device) => device.kind === kind)
      .map((device, index) => ({
        deviceId: device.deviceId,
        label:
          device.label ||
          `${kind === "audioinput" ? "Mikrofon" : kind === "videoinput" ? "Kamera" : "Speaker"} ${index + 1}`,
      }));
  } catch {
    return [];
  }
}

export async function ensureMediaPermission(): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    for (const track of stream.getTracks()) {
      track.stop();
    }
  } catch {
    // Permission may already be granted for one device kind.
  }
}
