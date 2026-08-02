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
        typeof parsed.audioinput === "string" && parsed.audioinput
          ? parsed.audioinput
          : undefined,
      videoinput:
        typeof parsed.videoinput === "string" && parsed.videoinput
          ? parsed.videoinput
          : undefined,
      audiooutput:
        typeof parsed.audiooutput === "string" && parsed.audiooutput
          ? parsed.audiooutput
          : undefined,
    };
  } catch {
    return {};
  }
}

export function storeMediaDevice(
  kind: keyof MediaDeviceSelections,
  deviceId: string,
) {
  if (typeof window === "undefined" || !deviceId) return;
  try {
    const current = readStoredMediaDevices();
    const next = { ...current, [kind]: deviceId };
    window.sessionStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore quota / private mode.
  }
}

export async function listMediaDevices(
  kind: MediaDeviceKind,
): Promise<MediaDeviceOption[]> {
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices?.enumerateDevices
  ) {
    return [];
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((device) => device.kind === kind && device.deviceId)
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

export function pickPreferredDeviceId(
  devices: MediaDeviceOption[],
  preferred?: string,
): string {
  if (preferred && devices.some((device) => device.deviceId === preferred)) {
    return preferred;
  }
  return devices[0]?.deviceId ?? "";
}

/**
 * Prefer ideal (not exact) so a stale sessionStorage deviceId does not
 * hard-fail getUserMedia.
 */
export function idealDeviceId(
  deviceId: string | undefined,
): { ideal: string } | undefined {
  const trimmed = deviceId?.trim();
  if (!trimmed || trimmed === "default" || trimmed === "communications") {
    return undefined;
  }
  return { ideal: trimmed };
}

export async function ensureMediaPermission(
  kinds: { audio?: boolean; video?: boolean } = { audio: true, video: true },
): Promise<void> {
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices?.getUserMedia
  ) {
    return;
  }
  const constraints: MediaStreamConstraints = {};
  if (kinds.audio) constraints.audio = true;
  if (kinds.video) constraints.video = true;
  if (!constraints.audio && !constraints.video) return;

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    for (const track of stream.getTracks()) {
      track.stop();
    }
  } catch {
    // Permission may already be granted for one device kind.
  }
}
