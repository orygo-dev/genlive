import { z } from "zod";

const optionalUrl = z.string().url().optional().or(z.literal(""));

export const productionEnvSchema = z.object({
  APP_URL: z
    .string()
    .url()
    .refine((value) => value.startsWith("https://"), {
      message: "APP_URL production harus memakai HTTPS.",
    }),
  DATABASE_URL: z.string().min(1),
  LIVEKIT_URL: z.string().url().startsWith("wss://"),
  LIVEKIT_API_KEY: z.string().min(1),
  LIVEKIT_API_SECRET: z.string().min(1),
  SESSION_COOKIE_NAME: z.string().min(1).optional(),
  LIVEKIT_API_URL: optionalUrl,
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  PAYMENT_PROVIDER: z.enum(["MIDTRANS", "IPAYMU", "FLIP"]).optional(),
});

export type ProductionEnvIssue = {
  key: string;
  message: string;
  optional?: boolean;
};

function has(env: NodeJS.ProcessEnv, key: string) {
  return Boolean(env[key]?.trim());
}

export function collectProductionEnvIssues(
  env: NodeJS.ProcessEnv = process.env,
): ProductionEnvIssue[] {
  const issues: ProductionEnvIssue[] = [];
  const parsed = productionEnvSchema.safeParse({
    APP_URL: env.APP_URL,
    DATABASE_URL: env.DATABASE_URL,
    LIVEKIT_URL: env.LIVEKIT_URL,
    LIVEKIT_API_KEY: env.LIVEKIT_API_KEY,
    LIVEKIT_API_SECRET: env.LIVEKIT_API_SECRET,
    SESSION_COOKIE_NAME: env.SESSION_COOKIE_NAME,
    LIVEKIT_API_URL: env.LIVEKIT_API_URL || undefined,
    RESEND_API_KEY: env.RESEND_API_KEY || undefined,
    EMAIL_FROM: env.EMAIL_FROM || undefined,
    PAYMENT_PROVIDER: env.PAYMENT_PROVIDER || undefined,
  });

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      issues.push({
        key: String(issue.path[0] ?? "env"),
        message: issue.message,
      });
    }
  }

  if (env.RESEND_API_KEY?.trim() && !env.EMAIL_FROM?.trim()) {
    issues.push({
      key: "EMAIL_FROM",
      message: "EMAIL_FROM wajib diisi jika RESEND_API_KEY disetel.",
    });
  }

  const provider = (env.PAYMENT_PROVIDER || "MIDTRANS").toUpperCase();

  if (provider === "MIDTRANS") {
    if (!has(env, "MIDTRANS_SERVER_KEY") || !has(env, "MIDTRANS_CLIENT_KEY")) {
      issues.push({
        key: "MIDTRANS",
        optional: true,
        message:
          "Untuk billing Midtrans, isi MIDTRANS_SERVER_KEY dan MIDTRANS_CLIENT_KEY (opsional jika billing belum dipakai).",
      });
    } else if (env.MIDTRANS_IS_PRODUCTION !== "true" && env.NODE_ENV === "production") {
      issues.push({
        key: "MIDTRANS_IS_PRODUCTION",
        optional: true,
        message:
          "Set MIDTRANS_IS_PRODUCTION=true saat go-live dengan kredensial production Midtrans.",
      });
    }
  }

  if (provider === "IPAYMU") {
    if (!has(env, "IPAYMU_VA") || !has(env, "IPAYMU_API_KEY")) {
      issues.push({
        key: "IPAYMU",
        optional: true,
        message:
          "Untuk billing iPaymu, isi IPAYMU_VA dan IPAYMU_API_KEY (opsional jika billing belum dipakai).",
      });
    } else if (env.IPAYMU_IS_PRODUCTION !== "true" && env.NODE_ENV === "production") {
      issues.push({
        key: "IPAYMU_IS_PRODUCTION",
        optional: true,
        message:
          "Set IPAYMU_IS_PRODUCTION=true saat go-live dengan kredensial production iPaymu.",
      });
    }
  }

  if (provider === "FLIP") {
    if (!has(env, "FLIP_SECRET_KEY") || !has(env, "FLIP_VALIDATION_TOKEN")) {
      issues.push({
        key: "FLIP",
        optional: true,
        message:
          "Untuk billing Flip, isi FLIP_SECRET_KEY dan FLIP_VALIDATION_TOKEN (opsional jika billing belum dipakai).",
      });
    } else if (env.FLIP_IS_PRODUCTION !== "true" && env.NODE_ENV === "production") {
      issues.push({
        key: "FLIP_IS_PRODUCTION",
        optional: true,
        message:
          "Set FLIP_IS_PRODUCTION=true saat go-live dengan kredensial production Flip.",
      });
    }
  }

  return issues;
}

export function getBlockingProductionEnvIssues(
  env: NodeJS.ProcessEnv = process.env,
) {
  return collectProductionEnvIssues(env).filter((issue) => !issue.optional);
}

export function assertProductionEnv() {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const blocking = getBlockingProductionEnvIssues();
  if (blocking.length === 0) {
    return;
  }

  const details = blocking
    .map((issue) => `${issue.key}: ${issue.message}`)
    .join("; ");
  throw new Error(`Konfigurasi production belum lengkap. ${details}`);
}
