import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdminApi } from "@/lib/admin-api";
import { isEncryptionConfigured } from "@/lib/crypto-secrets";
import {
  getPlatformConfig,
  getStoredIntegrations,
  maskSecret,
  saveIntegrations,
  type PlatformIntegrations,
} from "@/lib/platform-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const optionalString = z.string().trim().max(2000).nullable().optional();
const optionalBool = z.boolean().nullable().optional();
const optionalLivekitUrl = z
  .string()
  .trim()
  .max(2000)
  .nullable()
  .optional()
  .refine(
    (value) =>
      value == null ||
      value === "" ||
      value.startsWith("wss://") ||
      value.startsWith("ws://"),
    {
      message:
        "LIVEKIT_URL harus diawali wss:// (contoh: wss://xxx.livekit.cloud)",
    },
  );

const patchSchema = z.object({
  appUrl: optionalString,
  cronSecret: optionalString,
  livekitUrl: optionalLivekitUrl,
  livekitApiKey: optionalString,
  livekitApiSecret: optionalString,
  livekitApiUrl: optionalString,
  livekitEgressS3AccessKey: optionalString,
  livekitEgressS3Secret: optionalString,
  livekitEgressS3Bucket: optionalString,
  livekitEgressS3Region: optionalString,
  livekitEgressS3Endpoint: optionalString,
  livekitEgressS3ForcePathStyle: optionalBool,
  resendApiKey: optionalString,
  emailFrom: optionalString,
  fonnteToken: optionalString,
  fonnteCountryCode: optionalString,
  paymentProvider: optionalString,
  midtransServerKey: optionalString,
  midtransClientKey: optionalString,
  midtransIsProduction: optionalBool,
  ipaymuVa: optionalString,
  ipaymuApiKey: optionalString,
  ipaymuIsProduction: optionalBool,
  flipSecretKey: optionalString,
  flipValidationToken: optionalString,
  flipIsProduction: optionalBool,
  googleClientId: optionalString,
  googleClientSecret: optionalString,
  clearKeys: z.array(z.string()).optional(),
});

const SECRET_KEYS = new Set([
  "cronSecret",
  "livekitApiKey",
  "livekitApiSecret",
  "livekitEgressS3AccessKey",
  "livekitEgressS3Secret",
  "resendApiKey",
  "fonnteToken",
  "midtransServerKey",
  "midtransClientKey",
  "ipaymuApiKey",
  "flipSecretKey",
  "flipValidationToken",
  "googleClientSecret",
]);

function applyPatch(
  current: PlatformIntegrations,
  patch: z.infer<typeof patchSchema>,
): PlatformIntegrations {
  const next: PlatformIntegrations = { ...current };
  const clear = new Set(patch.clearKeys ?? []);

  for (const key of Object.keys(patch) as Array<keyof typeof patch>) {
    if (key === "clearKeys") continue;
    if (clear.has(key)) {
      (next as Record<string, unknown>)[key] = null;
      continue;
    }
    const value = patch[key];
    if (value === undefined) continue;
    if (SECRET_KEYS.has(key) && value === "") continue;
    if (SECRET_KEYS.has(key) && value === "••••••••") continue;
    (next as Record<string, unknown>)[key] = value;
  }

  return next;
}

export async function GET() {
  try {
    const gate = await requireSuperAdminApi();
    if (gate.error || !gate.context) return gate.error!;

    const [resolved, stored] = await Promise.all([
      getPlatformConfig(),
      getStoredIntegrations(),
    ]);

    return NextResponse.json({
      encryptionConfigured: isEncryptionConfigured(),
      integrations: {
        appUrl: resolved.appUrl,
        cronSecret: maskSecret(resolved.cronSecret),
        cronSecretSet: Boolean(resolved.cronSecret),
        livekitUrl: resolved.livekitUrl,
        livekitApiKey: maskSecret(resolved.livekitApiKey),
        livekitApiKeySet: Boolean(resolved.livekitApiKey),
        livekitApiSecret: maskSecret(resolved.livekitApiSecret),
        livekitApiSecretSet: Boolean(resolved.livekitApiSecret),
        livekitApiUrl: resolved.livekitApiUrl,
        livekitEgressS3AccessKey: maskSecret(resolved.livekitEgressS3AccessKey),
        livekitEgressS3AccessKeySet: Boolean(resolved.livekitEgressS3AccessKey),
        livekitEgressS3Secret: maskSecret(resolved.livekitEgressS3Secret),
        livekitEgressS3SecretSet: Boolean(resolved.livekitEgressS3Secret),
        livekitEgressS3Bucket: resolved.livekitEgressS3Bucket,
        livekitEgressS3Region: resolved.livekitEgressS3Region,
        livekitEgressS3Endpoint: resolved.livekitEgressS3Endpoint,
        livekitEgressS3ForcePathStyle: resolved.livekitEgressS3ForcePathStyle,
        resendApiKey: maskSecret(resolved.resendApiKey),
        resendApiKeySet: Boolean(resolved.resendApiKey),
        emailFrom: resolved.emailFrom,
        fonnteToken: maskSecret(resolved.fonnteToken),
        fonnteTokenSet: Boolean(resolved.fonnteToken),
        fonnteCountryCode: resolved.fonnteCountryCode,
        paymentProvider: resolved.paymentProvider,
        midtransServerKey: maskSecret(resolved.midtransServerKey),
        midtransServerKeySet: Boolean(resolved.midtransServerKey),
        midtransClientKey: maskSecret(resolved.midtransClientKey),
        midtransClientKeySet: Boolean(resolved.midtransClientKey),
        midtransIsProduction: resolved.midtransIsProduction,
        ipaymuVa: resolved.ipaymuVa,
        ipaymuApiKey: maskSecret(resolved.ipaymuApiKey),
        ipaymuApiKeySet: Boolean(resolved.ipaymuApiKey),
        ipaymuIsProduction: resolved.ipaymuIsProduction,
        flipSecretKey: maskSecret(resolved.flipSecretKey),
        flipSecretKeySet: Boolean(resolved.flipSecretKey),
        flipValidationToken: maskSecret(resolved.flipValidationToken),
        flipValidationTokenSet: Boolean(resolved.flipValidationToken),
        flipIsProduction: resolved.flipIsProduction,
        googleClientId: resolved.googleClientId,
        googleClientSecret: maskSecret(resolved.googleClientSecret),
        googleClientSecretSet: Boolean(resolved.googleClientSecret),
        storedKeys: Object.keys(stored).filter(
          (key) =>
            (stored as Record<string, unknown>)[key] != null &&
            (stored as Record<string, unknown>)[key] !== "",
        ),
      },
    });
  } catch (error) {
    console.error("Admin integrations GET failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Gagal memuat integrasi.",
      },
      { status: 500 },
    );
  }
}

async function saveIntegrationsRequest(request: Request) {
  const gate = await requireSuperAdminApi();
  if (gate.error || !gate.context) return gate.error!;

  if (!isEncryptionConfigured()) {
    return NextResponse.json(
      {
        error:
          "Enkripsi belum siap di server (butuh DATABASE_URL). Restart PM2 setelah env lengkap.",
      },
      { status: 400 },
    );
  }

  const payload: unknown = await request.json();
  const parsed = patchSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const current = await getStoredIntegrations();
  const next = applyPatch(current, parsed.data);
  await saveIntegrations(next, gate.context.user.id);

  return NextResponse.json({ ok: true });
}

/** POST — preferred (Apache/aaPanel often mishandles PATCH and returns HTML). */
export async function POST(request: Request) {
  try {
    return await saveIntegrationsRequest(request);
  } catch (error) {
    console.error("Admin integrations POST failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Gagal menyimpan integrasi.",
      },
      { status: 500 },
    );
  }
}

/** PATCH kept for compatibility. */
export async function PATCH(request: Request) {
  try {
    return await saveIntegrationsRequest(request);
  } catch (error) {
    console.error("Admin integrations PATCH failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Gagal menyimpan integrasi.",
      },
      { status: 500 },
    );
  }
}
