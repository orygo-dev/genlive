import { z } from "zod";
import { getPlatformConfig } from "@/lib/platform-config";
import { normalizeLivekitUrl } from "@/lib/livekit-url";

const liveKitEnvironmentSchema = z.object({
  LIVEKIT_URL: z.string().url().startsWith("wss://"),
  LIVEKIT_API_KEY: z.string().min(1),
  LIVEKIT_API_SECRET: z.string().min(1),
});

export type LiveKitEnvironment = z.infer<typeof liveKitEnvironmentSchema>;

export async function getLiveKitEnvironment(): Promise<LiveKitEnvironment> {
  const config = await getPlatformConfig();
  const result = liveKitEnvironmentSchema.safeParse({
    LIVEKIT_URL: normalizeLivekitUrl(config.livekitUrl),
    LIVEKIT_API_KEY: config.livekitApiKey?.trim(),
    LIVEKIT_API_SECRET: config.livekitApiSecret?.trim(),
  });

  if (!result.success) {
    throw new Error(
      "Konfigurasi LiveKit belum lengkap. Isi di Super Admin → Integrasi (URL wss://, API Key, API Secret).",
    );
  }

  return result.data;
}
