/**
 * Normalize LiveKit Cloud / self-hosted URLs pasted from the dashboard.
 * Accepts wss/ws and converts accidental https/http.
 */
export function normalizeLivekitUrl(
  raw: string | null | undefined,
): string | null {
  if (raw == null) return null;
  let value = raw.trim();
  if (!value) return null;
  value = value.replace(/\/+$/, "");
  if (value.startsWith("https://")) {
    value = `wss://${value.slice("https://".length)}`;
  } else if (value.startsWith("http://")) {
    value = `ws://${value.slice("http://".length)}`;
  }
  return value;
}

/** Strip quotes/whitespace that often sneak in from .env or admin paste. */
export function sanitizeLivekitCredential(
  value: string | null | undefined,
): string | null {
  if (value == null) return null;
  let next = value.trim();
  if (
    (next.startsWith('"') && next.endsWith('"')) ||
    (next.startsWith("'") && next.endsWith("'"))
  ) {
    next = next.slice(1, -1).trim();
  }
  return next || null;
}

export function normalizeLivekitApiUrl(
  raw: string | null | undefined,
  livekitUrl?: string | null,
): string | null {
  const explicit = raw?.trim().replace(/\/+$/, "") || "";
  if (explicit) {
    if (explicit.startsWith("wss://")) {
      return `https://${explicit.slice("wss://".length)}`;
    }
    if (explicit.startsWith("ws://")) {
      return `http://${explicit.slice("ws://".length)}`;
    }
    return explicit;
  }
  const fromWss = normalizeLivekitUrl(livekitUrl);
  if (!fromWss) return null;
  if (fromWss.startsWith("wss://")) {
    return `https://${fromWss.slice("wss://".length)}`;
  }
  if (fromWss.startsWith("ws://")) {
    return `http://${fromWss.slice("ws://".length)}`;
  }
  return null;
}

export function isValidLivekitUrl(value: string | null | undefined): boolean {
  const normalized = normalizeLivekitUrl(value);
  return Boolean(
    normalized &&
      (normalized.startsWith("wss://") || normalized.startsWith("ws://")),
  );
}
