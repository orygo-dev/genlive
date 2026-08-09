import "server-only";

import { z } from "zod";
import {
  findActiveLiveKitServer,
  normalizeLiveKitServerProfile,
  normalizeLiveKitServerProfiles,
  type LiveKitServerProfile,
} from "@/lib/livekit-config";
import { getStoredIntegrations } from "@/lib/platform-config";
import {
  deriveLivekitApiUrl,
  isLivekitCloudUrl,
  normalizeLivekitUrl,
  sanitizeLivekitCredential,
} from "@/lib/livekit-url";

export { sanitizeLivekitCredential } from "@/lib/livekit-url";

const liveKitEnvironmentSchema = z.object({
  LIVEKIT_SERVER_ID: z.string().min(1),
  LIVEKIT_SERVER_NAME: z.string().min(1),
  LIVEKIT_KIND: z.enum(["CLOUD", "SELF_HOSTED"]),
  // Cloud requires wss; self-hosted may use ws on private networks.
  LIVEKIT_URL: z
    .string()
    .url()
    .refine(
      (value) => value.startsWith("wss://") || value.startsWith("ws://"),
      "LIVEKIT_URL harus diawali wss:// atau ws://",
    ),
  // Always present for SDK admin calls; derived from LIVEKIT_URL for Cloud.
  LIVEKIT_API_URL: z
    .string()
    .url()
    .refine(
      (value) => value.startsWith("https://") || value.startsWith("http://"),
      "Host API LiveKit harus diawali https:// atau http://",
    ),
  LIVEKIT_API_KEY: z.string().min(1),
  LIVEKIT_API_SECRET: z.string().min(1),
});

export type LiveKitEnvironment = z.infer<typeof liveKitEnvironmentSchema>;

function legacyProfile(input: {
  id: string;
  name: string;
  url: string | null | undefined;
  apiUrl: string | null | undefined;
  apiKey: string | null | undefined;
  apiSecret: string | null | undefined;
}): LiveKitServerProfile | null {
  const url = normalizeLivekitUrl(sanitizeLivekitCredential(input.url));
  return normalizeLiveKitServerProfile({
    id: input.id,
    name: input.name,
    kind: isLivekitCloudUrl(url) ? "CLOUD" : "SELF_HOSTED",
    url: url ?? undefined,
    apiUrl: input.apiUrl ?? undefined,
    apiKey: sanitizeLivekitCredential(input.apiKey) ?? undefined,
    apiSecret: sanitizeLivekitCredential(input.apiSecret) ?? undefined,
  });
}

export async function getLiveKitServerProfiles() {
  const stored = await getStoredIntegrations();
  const profiles = normalizeLiveKitServerProfiles(stored.livekitServers);
  if (profiles.length > 0) return profiles;

  const database = legacyProfile({
    id: "legacy-database",
    name: "LiveKit tersimpan",
    url: stored.livekitUrl,
    apiUrl: stored.livekitApiUrl,
    apiKey: stored.livekitApiKey,
    apiSecret: stored.livekitApiSecret,
  });
  if (database) return [database];

  const environment = legacyProfile({
    id: "environment",
    name: "LiveKit environment",
    url: process.env.LIVEKIT_URL,
    apiUrl: process.env.LIVEKIT_API_URL,
    apiKey: process.env.LIVEKIT_API_KEY,
    apiSecret: process.env.LIVEKIT_API_SECRET,
  });
  return environment ? [environment] : [];
}

export async function getLiveKitEnvironment(
  serverId?: string | null,
): Promise<LiveKitEnvironment> {
  const stored = await getStoredIntegrations();
  const profiles = await getLiveKitServerProfiles();
  const selected = serverId
    ? profiles.find((profile) => profile.id === serverId)
    : findActiveLiveKitServer(profiles, stored.activeLivekitServerId);

  const result = liveKitEnvironmentSchema.safeParse(
    selected
      ? {
          LIVEKIT_SERVER_ID: selected.id,
          LIVEKIT_SERVER_NAME: selected.name,
          LIVEKIT_KIND: selected.kind,
          LIVEKIT_URL: selected.url,
          LIVEKIT_API_URL:
            selected.kind === "CLOUD"
              ? deriveLivekitApiUrl(selected.url)
              : selected.apiUrl || deriveLivekitApiUrl(selected.url),
          LIVEKIT_API_KEY: selected.apiKey,
          LIVEKIT_API_SECRET: selected.apiSecret,
        }
      : {},
  );

  if (!result.success) {
    throw new Error(
      serverId
        ? "Server LiveKit yang dipilih tidak ditemukan atau konfigurasinya belum lengkap (URL + API Key + API Secret)."
        : "Konfigurasi LiveKit belum lengkap. Di Super Admin → Integrasi, set LIVEKIT_URL (wss://…livekit.cloud), API Key, dan API Secret dari project yang sama, lalu Simpan & Tes koneksi.",
    );
  }

  return result.data;
}
