import { z } from "zod";
import { getPlatformConfig } from "@/lib/platform-config";

const liveKitEnvironmentSchema = z.object({
  LIVEKIT_URL: z.string().url().startsWith("wss://"),
  LIVEKIT_API_KEY: z.string().min(1),
  LIVEKIT_API_SECRET: z.string().min(1),
});

export type LiveKitEnvironment = z.infer<typeof liveKitEnvironmentSchema>;

export async function getLiveKitEnvironment(): Promise<LiveKitEnvironment> {
  const config = await getPlatformConfig();
  const result = liveKitEnvironmentSchema.safeParse({
    LIVEKIT_URL: config.livekitUrl,
    LIVEKIT_API_KEY: config.livekitApiKey,
    LIVEKIT_API_SECRET: config.livekitApiSecret,
  });

  if (!result.success) {
    throw new Error(
      "Konfigurasi LiveKit belum lengkap. Isi di Super Admin → Integrasi atau di .env.",
    );
  }

  return result.data;
}
