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

/** Strip quotes/whitespace/control chars that often sneak in from .env or admin paste. */
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
  // Pasted secrets sometimes include newlines or zero-width chars → invalid JWT signature.
  next = next.replace(/[\r\n\t\u200b\ufeff]/g, "").trim();
  return next || null;
}

export function isLivekitCloudUrl(url: string | null | undefined): boolean {
  const normalized = normalizeLivekitUrl(url);
  return Boolean(normalized?.includes(".livekit.cloud"));
}

/**
 * Derive the HTTPS API host LiveKit Server SDK expects from the WebSocket URL.
 * LiveKit Cloud does NOT use a separate API URL — it is the same host as LIVEKIT_URL.
 */
export function deriveLivekitApiUrl(
  livekitUrl: string | null | undefined,
): string | null {
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

/**
 * Resolve API URL for RoomServiceClient / EgressClient.
 * - Cloud: always derived from LIVEKIT_URL (ignore custom override).
 * - Self-hosted: optional explicit https API host, else derived from LIVEKIT_URL.
 */
export function normalizeLivekitApiUrl(
  raw: string | null | undefined,
  livekitUrl?: string | null,
  options?: { kind?: "CLOUD" | "SELF_HOSTED"; forceDerive?: boolean },
): string | null {
  const kind =
    options?.kind ??
    (isLivekitCloudUrl(livekitUrl) ? "CLOUD" : "SELF_HOSTED");
  if (kind === "CLOUD" || options?.forceDerive) {
    return deriveLivekitApiUrl(livekitUrl);
  }

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
  return deriveLivekitApiUrl(livekitUrl);
}

export function isValidLivekitUrl(value: string | null | undefined): boolean {
  const normalized = normalizeLivekitUrl(value);
  return Boolean(
    normalized &&
      (normalized.startsWith("wss://") || normalized.startsWith("ws://")),
  );
}

export type LiveKitFailureKind =
  | "invalid_api_key"
  | "invalid_signature"
  | "expired_token"
  | "wrong_server"
  | "malformed_token"
  | "network"
  | "tls"
  | "unauthorized"
  | "config"
  | "unknown";

export function classifyLiveKitFailure(
  message: string,
  context?: { url?: string | null; kind?: "CLOUD" | "SELF_HOSTED" },
): { kind: LiveKitFailureKind; hint: string } {
  const lower = message.toLowerCase();
  const isCloud =
    context?.kind === "CLOUD" || isLivekitCloudUrl(context?.url);

  // LiveKit Server often replies "invalid token" when the admin JWT
  // (signed with API Key/Secret) is rejected — that is unauthorized, NOT a
  // malformed JWT string from GenMeet.
  if (
    lower.includes("invalid token") ||
    lower.includes("401") ||
    lower.includes("unauthorized") ||
    lower.includes("permission denied")
  ) {
    return {
      kind: "unauthorized",
      hint: isCloud
        ? "API Key/Secret ditolak project Cloud ini. Salin ulang Key + Secret dari project yang sama dengan LIVEKIT_URL (wss://…livekit.cloud), lalu Simpan & Tes lagi."
        : "API Key/Secret ditolak server self-hosted (cek keys.yaml / LIVEKIT_KEYS).",
    };
  }
  if (
    lower.includes("bukan jwt") ||
    lower.includes("malformed") ||
    (lower.includes("jwt") && lower.includes("compact"))
  ) {
    return {
      kind: "malformed_token",
      hint: "Token rusak atau tidak berbentuk JWT.",
    };
  }
  if (lower.includes("expired") || lower.includes("token is expired")) {
    return {
      kind: "expired_token",
      hint: "Token kedaluwarsa — cek jam NTP server GenMeet.",
    };
  }
  if (
    lower.includes("signature") ||
    lower.includes("cannot verify") ||
    (lower.includes("verify") && lower.includes("token"))
  ) {
    return {
      kind: "invalid_signature",
      hint: isCloud
        ? "API Secret tidak cocok dengan API Key project Cloud yang sama."
        : "API Secret tidak cocok dengan keys.yaml / LIVEKIT_KEYS self-hosted.",
    };
  }
  if (
    lower.includes("unknown api key") ||
    lower.includes("invalid api key") ||
    (lower.includes("api key") && lower.includes("invalid"))
  ) {
    return {
      kind: "invalid_api_key",
      hint: isCloud
        ? "API Key tidak dikenal di project Cloud tersebut."
        : "API Key tidak dikenal di server self-hosted.",
    };
  }
  if (
    lower.includes("enotfound") ||
    lower.includes("econnrefused") ||
    lower.includes("fetch failed") ||
    lower.includes("network") ||
    lower.includes("getaddrinfo")
  ) {
    return {
      kind: "network",
      hint: isCloud
        ? "Server GenMeet tidak dapat menjangkau *.livekit.cloud — cek DNS/firewall outbound."
        : "LIVEKIT_URL/API host self-hosted tidak dapat dijangkau dari server GenMeet.",
    };
  }
  if (
    lower.includes("certificate") ||
    lower.includes("ssl") ||
    lower.includes("tls") ||
    lower.includes("cert")
  ) {
    return {
      kind: "tls",
      hint: "Sertifikat TLS LiveKit bermasalah.",
    };
  }
  if (
    (lower.includes("wrong") && lower.includes("server")) ||
    lower.includes("does not match") ||
    lower.includes("iss mismatch")
  ) {
    return {
      kind: "wrong_server",
      hint: "Token ditandatangani untuk server/project berbeda dari LIVEKIT_URL aktif.",
    };
  }

  return { kind: "unknown", hint: "" };
}
