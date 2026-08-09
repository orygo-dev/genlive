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
import {
  normalizeLivekitApiUrl,
  normalizeLivekitUrl,
} from "@/lib/livekit-url";
import {
  normalizeLiveKitServerProfile,
  normalizeLiveKitServerProfiles,
} from "@/lib/livekit-config";
import { getLiveKitServerProfiles } from "@/lib/livekit";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const optionalString = z.string().trim().max(2000).nullable().optional();
const optionalBool = z.boolean().nullable().optional();
const livekitServerSchema = z.object({
  id: z.string().trim().min(1).max(80),
  name: z.string().trim().min(2).max(80),
  kind: z.enum(["CLOUD", "SELF_HOSTED"]),
  url: z.string().trim().min(1).max(2000),
  apiUrl: z.string().trim().max(2000).nullable().optional(),
  apiKey: z.string().trim().max(2000).nullable().optional(),
  apiSecret: z.string().trim().max(2000).nullable().optional(),
});
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
      value.startsWith("ws://") ||
      value.startsWith("https://") ||
      value.startsWith("http://"),
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
  livekitServers: z.array(livekitServerSchema).min(1).max(10).optional(),
  activeLivekitServerId: optionalString,
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

    const [resolved, stored, livekitServers] = await Promise.all([
      getPlatformConfig(),
      getStoredIntegrations(),
      getLiveKitServerProfiles(),
    ]);

    const livekitReady = Boolean(
      resolved.livekitUrl &&
        resolved.livekitApiKey &&
        resolved.livekitApiSecret,
    );

    return NextResponse.json({
      encryptionConfigured: isEncryptionConfigured(),
      livekitReady,
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
        activeLivekitServerId: resolved.activeLivekitServerId,
        livekitServers: livekitServers.map((server) => ({
          id: server.id,
          name: server.name,
          kind: server.kind,
          url: server.url,
          apiUrl: server.apiUrl,
          apiKeySet: Boolean(server.apiKey),
          apiSecretSet: Boolean(server.apiSecret),
        })),
        livekitStoredInDatabase: Boolean(
          normalizeLiveKitServerProfiles(stored.livekitServers).length > 0 ||
            stored.livekitUrl ||
            stored.livekitApiKey ||
            stored.livekitApiSecret,
        ),
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

  if (parsed.data.livekitServers) {
    const currentProfiles = await getLiveKitServerProfiles();
    const currentById = new Map(
      currentProfiles.map((server) => [server.id, server]),
    );
    const ids = new Set<string>();
    const profiles = parsed.data.livekitServers.map((server) => {
      if (ids.has(server.id)) {
        throw new Error(`ID profil LiveKit duplikat: ${server.id}`);
      }
      ids.add(server.id);
      const previous = currentById.get(server.id);
      const normalized = normalizeLiveKitServerProfile({
        ...server,
        kind: server.kind,
        apiUrl: server.apiUrl ?? undefined,
        apiKey: server.apiKey || previous?.apiKey,
        apiSecret: server.apiSecret || previous?.apiSecret,
      });
      if (!normalized) {
        throw new Error(
          `Profil LiveKit “${server.name}” belum lengkap. Isi URL, API Key, dan API Secret.`,
        );
      }
      return normalized;
    });
    next.livekitServers = profiles;
    const requestedActive = parsed.data.activeLivekitServerId?.trim();
    next.activeLivekitServerId = profiles.some(
      (server) => server.id === requestedActive,
    )
      ? requestedActive!
      : profiles[0].id;
    const currentActiveId =
      current.activeLivekitServerId || currentProfiles[0]?.id || null;
    if (
      currentActiveId &&
      next.activeLivekitServerId !== currentActiveId &&
      (await prisma.meeting.count({ where: { status: "ACTIVE" } })) > 0
    ) {
      throw new Error(
        "Server aktif tidak dapat diganti saat masih ada meeting berlangsung. Akhiri meeting aktif terlebih dahulu.",
      );
    }
  }

  if (Object.prototype.hasOwnProperty.call(parsed.data, "livekitUrl")) {
    next.livekitUrl = normalizeLivekitUrl(next.livekitUrl ?? null);
  }
  if (
    Object.prototype.hasOwnProperty.call(parsed.data, "livekitApiUrl") ||
    Object.prototype.hasOwnProperty.call(parsed.data, "livekitUrl")
  ) {
    next.livekitApiUrl = normalizeLivekitApiUrl(
      next.livekitApiUrl ?? null,
      next.livekitUrl ?? current.livekitUrl,
    );
  }
  if (typeof next.livekitApiKey === "string") {
    next.livekitApiKey = next.livekitApiKey.trim() || null;
  }
  if (typeof next.livekitApiSecret === "string") {
    next.livekitApiSecret = next.livekitApiSecret.trim() || null;
  }

  await saveIntegrations(next, gate.context.user.id);
  const resolved = await getPlatformConfig();

  return NextResponse.json({
    ok: true,
    livekitReady: Boolean(
      resolved.livekitUrl &&
        resolved.livekitApiKey &&
        resolved.livekitApiSecret,
    ),
  });
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
