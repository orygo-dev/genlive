import { z } from "zod";

const liveKitEnvironmentSchema = z.object({
  LIVEKIT_URL: z.string().url().startsWith("wss://"),
  LIVEKIT_API_KEY: z.string().min(1),
  LIVEKIT_API_SECRET: z.string().min(1),
});

export type LiveKitEnvironment = z.infer<typeof liveKitEnvironmentSchema>;

export function getLiveKitEnvironment(): LiveKitEnvironment {
  const result = liveKitEnvironmentSchema.safeParse({
    LIVEKIT_URL: process.env.LIVEKIT_URL,
    LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY,
    LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET,
  });

  if (!result.success) {
    throw new Error(
      "Konfigurasi LiveKit belum lengkap. Salin .env.example menjadi .env.local lalu isi kredensial LiveKit.",
    );
  }

  return result.data;
}
