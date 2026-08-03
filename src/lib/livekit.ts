import { z } from "zod";
import { getPlatformConfig } from "@/lib/platform-config";
import {
  normalizeLivekitUrl,
  sanitizeLivekitCredential,
} from "@/lib/livekit-url";

export { sanitizeLivekitCredential } from "@/lib/livekit-url";

const liveKitEnvironmentSchema = z.object({
  LIVEKIT_URL: z.string().url().startsWith("wss://"),
  LIVEKIT_API_KEY: z.string().min(1),
  LIVEKIT_API_SECRET: z.string().min(1),
});

export type LiveKitEnvironment = z.infer<typeof liveKitEnvironmentSchema>;

type LiveKitTriplet = {
  url: string;
  apiKey: string;
  apiSecret: string;
};

/**
 * Resolve URL + key + secret as one set.
 * Mixing admin URL with .env keys (or vice versa) causes "invalid token".
 */
function resolveLiveKitTriplet(config: {
  livekitUrl: string | null;
  livekitApiKey: string | null;
  livekitApiSecret: string | null;
}): LiveKitTriplet | null {
  const dbUrl = normalizeLivekitUrl(sanitizeLivekitCredential(config.livekitUrl));
  const dbKey = sanitizeLivekitCredential(config.livekitApiKey);
  const dbSecret = sanitizeLivekitCredential(config.livekitApiSecret);

  const envUrl = normalizeLivekitUrl(
    sanitizeLivekitCredential(process.env.LIVEKIT_URL),
  );
  const envKey = sanitizeLivekitCredential(process.env.LIVEKIT_API_KEY);
  const envSecret = sanitizeLivekitCredential(process.env.LIVEKIT_API_SECRET);

  // Prefer a complete database set (from Super Admin → Integrasi).
  if (dbUrl && dbKey && dbSecret) {
    return { url: dbUrl, apiKey: dbKey, apiSecret: dbSecret };
  }

  // Else a complete env set.
  if (envUrl && envKey && envSecret) {
    return { url: envUrl, apiKey: envKey, apiSecret: envSecret };
  }

  // Last resort: fill gaps, but only when the result is complete.
  const url = dbUrl || envUrl;
  const apiKey = dbKey || envKey;
  const apiSecret = dbSecret || envSecret;
  if (url && apiKey && apiSecret) {
    if (
      (dbUrl && !dbKey) ||
      (dbKey && !dbSecret) ||
      (dbUrl && envKey && dbKey !== envKey)
    ) {
      console.warn(
        "[livekit] Kredensial LiveKit tercampur antara database dan .env — pastikan URL/key/secret dari project yang sama.",
      );
    }
    return { url, apiKey, apiSecret };
  }

  return null;
}

export async function getLiveKitEnvironment(): Promise<LiveKitEnvironment> {
  const config = await getPlatformConfig();
  const triplet = resolveLiveKitTriplet(config);

  const result = liveKitEnvironmentSchema.safeParse(
    triplet
      ? {
          LIVEKIT_URL: triplet.url,
          LIVEKIT_API_KEY: triplet.apiKey,
          LIVEKIT_API_SECRET: triplet.apiSecret,
        }
      : {
          LIVEKIT_URL: normalizeLivekitUrl(config.livekitUrl),
          LIVEKIT_API_KEY: sanitizeLivekitCredential(config.livekitApiKey),
          LIVEKIT_API_SECRET: sanitizeLivekitCredential(config.livekitApiSecret),
        },
  );

  if (!result.success) {
    throw new Error(
      "Konfigurasi LiveKit belum lengkap. Isi URL wss://, API Key, dan API Secret dari project yang sama di Super Admin → Integrasi (atau .env).",
    );
  }

  return result.data;
}
