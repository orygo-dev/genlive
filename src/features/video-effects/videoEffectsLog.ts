type LogPayload = Record<string, unknown>;

const isDev =
  typeof process !== "undefined" && process.env.NODE_ENV !== "production";

export function videoEffectsLog(event: string, payload?: LogPayload) {
  if (!isDev) return;
  console.debug(`[video-effects] ${event}`, payload ?? {});
}
