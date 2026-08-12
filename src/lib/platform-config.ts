import "server-only";

import { prisma } from "@/lib/db";
import {
  findActiveLiveKitServer,
  normalizeLiveKitServerProfiles,
  type LiveKitServerProfile,
} from "@/lib/livekit-config";
import {
  decryptSecretPayload,
  encryptSecretPayload,
  isEncryptionConfigured,
} from "@/lib/crypto-secrets";
import {
  DEFAULT_PLAN_CATALOG,
  type PlanCatalog,
  type PlanCodeValue,
  type PlanDefinition,
  normalizePlanCatalog,
} from "@/lib/plans";

export type PlatformIntegrations = {
  appUrl?: string | null;
  cronSecret?: string | null;
  livekitUrl?: string | null;
  livekitApiKey?: string | null;
  livekitApiSecret?: string | null;
  livekitApiUrl?: string | null;
  livekitServers?: LiveKitServerProfile[] | null;
  activeLivekitServerId?: string | null;
  livekitEgressS3AccessKey?: string | null;
  livekitEgressS3Secret?: string | null;
  livekitEgressS3Bucket?: string | null;
  livekitEgressS3Region?: string | null;
  livekitEgressS3Endpoint?: string | null;
  livekitEgressS3ForcePathStyle?: boolean | null;
  livekitEgressS3PublicBaseUrl?: string | null;
  resendApiKey?: string | null;
  emailFrom?: string | null;
  fonnteToken?: string | null;
  fonnteCountryCode?: string | null;
  paymentProvider?: string | null;
  midtransServerKey?: string | null;
  midtransClientKey?: string | null;
  midtransIsProduction?: boolean | null;
  ipaymuVa?: string | null;
  ipaymuApiKey?: string | null;
  ipaymuIsProduction?: boolean | null;
  flipSecretKey?: string | null;
  flipValidationToken?: string | null;
  flipIsProduction?: boolean | null;
  googleClientId?: string | null;
  googleClientSecret?: string | null;
};

export type ResolvedPlatformConfig = {
  appUrl: string | null;
  cronSecret: string | null;
  livekitUrl: string | null;
  livekitApiKey: string | null;
  livekitApiSecret: string | null;
  livekitApiUrl: string | null;
  livekitServers: LiveKitServerProfile[];
  activeLivekitServerId: string | null;
  livekitEgressS3AccessKey: string | null;
  livekitEgressS3Secret: string | null;
  livekitEgressS3Bucket: string | null;
  livekitEgressS3Region: string | null;
  livekitEgressS3Endpoint: string | null;
  livekitEgressS3ForcePathStyle: boolean;
  livekitEgressS3PublicBaseUrl: string | null;
  resendApiKey: string | null;
  emailFrom: string | null;
  fonnteToken: string | null;
  fonnteCountryCode: string;
  paymentProvider: string | null;
  midtransServerKey: string | null;
  midtransClientKey: string | null;
  midtransIsProduction: boolean;
  ipaymuVa: string | null;
  ipaymuApiKey: string | null;
  ipaymuIsProduction: boolean;
  flipSecretKey: string | null;
  flipValidationToken: string | null;
  flipIsProduction: boolean;
  googleClientId: string | null;
  googleClientSecret: string | null;
  planCatalog: PlanCatalog;
  encryptionConfigured: boolean;
};

function pick(
  dbValue: string | null | undefined,
  envValue: string | undefined,
): string | null {
  const fromDb = dbValue?.trim();
  if (fromDb) return fromDb;
  const fromEnv = envValue?.trim();
  return fromEnv || null;
}

function pickBool(
  dbValue: boolean | null | undefined,
  envValue: string | undefined,
  fallback = false,
): boolean {
  if (typeof dbValue === "boolean") return dbValue;
  if (envValue === "true") return true;
  if (envValue === "false") return false;
  return fallback;
}

function decodeIntegrations(cipher: string | null | undefined): PlatformIntegrations {
  if (!cipher?.trim()) return {};
  if (!isEncryptionConfigured()) return {};
  try {
    return JSON.parse(decryptSecretPayload(cipher)) as PlatformIntegrations;
  } catch {
    console.error("Gagal mendekripsi integrations platform.");
    return {};
  }
}

let memoryCache: { at: number; value: ResolvedPlatformConfig } | null = null;
const CACHE_MS = 5_000;

export function invalidatePlatformConfigCache() {
  memoryCache = null;
}

async function loadPlatformConfig(): Promise<ResolvedPlatformConfig> {
  if (memoryCache && Date.now() - memoryCache.at < CACHE_MS) {
    return memoryCache.value;
  }

  let integrations: PlatformIntegrations = {};
  let planCatalog: PlanCatalog = DEFAULT_PLAN_CATALOG;

  try {
    const settings = await prisma.platformSettings.findUnique({
      where: { id: 1 },
      select: {
        integrationsCipher: true,
        planCatalog: true,
      },
    });
    integrations = decodeIntegrations(settings?.integrationsCipher);
    planCatalog = normalizePlanCatalog(settings?.planCatalog);
  } catch {
    // DB may be unavailable during build; fall back to env defaults.
  }

  const livekitServers = normalizeLiveKitServerProfiles(integrations.livekitServers);
  const activeLivekitServer = findActiveLiveKitServer(
    livekitServers,
    integrations.activeLivekitServerId,
  );
  const legacyDatabaseComplete = Boolean(
    integrations.livekitUrl?.trim() &&
      integrations.livekitApiKey?.trim() &&
      integrations.livekitApiSecret?.trim(),
  );
  const legacyEnvironmentComplete = Boolean(
    process.env.LIVEKIT_URL?.trim() &&
      process.env.LIVEKIT_API_KEY?.trim() &&
      process.env.LIVEKIT_API_SECRET?.trim(),
  );
  const legacyUrl = legacyDatabaseComplete
    ? integrations.livekitUrl?.trim() || null
    : legacyEnvironmentComplete
      ? process.env.LIVEKIT_URL?.trim() || null
      : null;
  const legacyApiKey = legacyDatabaseComplete
    ? integrations.livekitApiKey?.trim() || null
    : legacyEnvironmentComplete
      ? process.env.LIVEKIT_API_KEY?.trim() || null
      : null;
  const legacyApiSecret = legacyDatabaseComplete
    ? integrations.livekitApiSecret?.trim() || null
    : legacyEnvironmentComplete
      ? process.env.LIVEKIT_API_SECRET?.trim() || null
      : null;
  const legacyApiUrl = legacyDatabaseComplete
    ? integrations.livekitApiUrl?.trim() || null
    : legacyEnvironmentComplete
      ? process.env.LIVEKIT_API_URL?.trim() || null
      : null;

  const value: ResolvedPlatformConfig = {
    appUrl: pick(integrations.appUrl, process.env.APP_URL),
    cronSecret: pick(integrations.cronSecret, process.env.CRON_SECRET),
    livekitUrl: activeLivekitServer?.url ?? legacyUrl,
    livekitApiKey: activeLivekitServer?.apiKey ?? legacyApiKey,
    livekitApiSecret: activeLivekitServer?.apiSecret ?? legacyApiSecret,
    livekitApiUrl: activeLivekitServer?.apiUrl ?? legacyApiUrl,
    livekitServers,
    activeLivekitServerId: activeLivekitServer?.id ?? null,
    livekitEgressS3AccessKey: pick(
      integrations.livekitEgressS3AccessKey,
      process.env.LIVEKIT_EGRESS_S3_ACCESS_KEY,
    ),
    livekitEgressS3Secret: pick(
      integrations.livekitEgressS3Secret,
      process.env.LIVEKIT_EGRESS_S3_SECRET,
    ),
    livekitEgressS3Bucket: pick(
      integrations.livekitEgressS3Bucket,
      process.env.LIVEKIT_EGRESS_S3_BUCKET,
    ),
    livekitEgressS3Region: pick(
      integrations.livekitEgressS3Region,
      process.env.LIVEKIT_EGRESS_S3_REGION,
    ),
    livekitEgressS3Endpoint: pick(
      integrations.livekitEgressS3Endpoint,
      process.env.LIVEKIT_EGRESS_S3_ENDPOINT,
    ),
    livekitEgressS3ForcePathStyle: pickBool(
      integrations.livekitEgressS3ForcePathStyle,
      process.env.LIVEKIT_EGRESS_S3_FORCE_PATH_STYLE,
    ),
    livekitEgressS3PublicBaseUrl: pick(
      integrations.livekitEgressS3PublicBaseUrl,
      process.env.LIVEKIT_EGRESS_S3_PUBLIC_BASE_URL,
    ),
    resendApiKey: pick(integrations.resendApiKey, process.env.RESEND_API_KEY),
    emailFrom: pick(integrations.emailFrom, process.env.EMAIL_FROM),
    fonnteToken: pick(integrations.fonnteToken, process.env.FONNTE_TOKEN),
    fonnteCountryCode:
      pick(integrations.fonnteCountryCode, process.env.FONNTE_COUNTRY_CODE) ||
      "62",
    paymentProvider: pick(
      integrations.paymentProvider,
      process.env.PAYMENT_PROVIDER,
    ),
    midtransServerKey: pick(
      integrations.midtransServerKey,
      process.env.MIDTRANS_SERVER_KEY,
    ),
    midtransClientKey: pick(
      integrations.midtransClientKey,
      process.env.MIDTRANS_CLIENT_KEY,
    ),
    midtransIsProduction: pickBool(
      integrations.midtransIsProduction,
      process.env.MIDTRANS_IS_PRODUCTION,
    ),
    ipaymuVa: pick(integrations.ipaymuVa, process.env.IPAYMU_VA),
    ipaymuApiKey: pick(integrations.ipaymuApiKey, process.env.IPAYMU_API_KEY),
    ipaymuIsProduction: pickBool(
      integrations.ipaymuIsProduction,
      process.env.IPAYMU_IS_PRODUCTION,
    ),
    flipSecretKey: pick(integrations.flipSecretKey, process.env.FLIP_SECRET_KEY),
    flipValidationToken: pick(
      integrations.flipValidationToken,
      process.env.FLIP_VALIDATION_TOKEN,
    ),
    flipIsProduction: pickBool(
      integrations.flipIsProduction,
      process.env.FLIP_IS_PRODUCTION,
    ),
    googleClientId: pick(integrations.googleClientId, process.env.GOOGLE_CLIENT_ID),
    googleClientSecret: pick(
      integrations.googleClientSecret,
      process.env.GOOGLE_CLIENT_SECRET,
    ),
    planCatalog,
    encryptionConfigured: isEncryptionConfigured(),
  };

  memoryCache = { at: Date.now(), value };
  return value;
}

export async function getPlatformConfig() {
  return loadPlatformConfig();
}

export async function getStoredIntegrations(): Promise<PlatformIntegrations> {
  const settings = await prisma.platformSettings.findUnique({
    where: { id: 1 },
    select: { integrationsCipher: true },
  });
  return decodeIntegrations(settings?.integrationsCipher);
}

export async function saveIntegrations(
  next: PlatformIntegrations,
  updatedById?: string | null,
) {
  const cipher = encryptSecretPayload(JSON.stringify(next));
  await prisma.platformSettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      integrationsCipher: cipher,
      updatedById: updatedById ?? null,
    },
    update: {
      integrationsCipher: cipher,
      updatedById: updatedById ?? null,
    },
  });
  invalidatePlatformConfigCache();
}

export async function savePlanCatalog(
  catalog: PlanCatalog,
  updatedById?: string | null,
) {
  const normalized = normalizePlanCatalog(catalog);
  await prisma.platformSettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      planCatalog: normalized,
      updatedById: updatedById ?? null,
    },
    update: {
      planCatalog: normalized,
      updatedById: updatedById ?? null,
    },
  });
  invalidatePlatformConfigCache();
  return normalized;
}

export async function resolvePlan(code: string | null | undefined): Promise<PlanDefinition> {
  const config = await getPlatformConfig();
  const key: PlanCodeValue = code === "PRO" ? "PRO" : "FREE";
  return config.planCatalog[key];
}

export function maskSecret(value: string | null | undefined) {
  if (!value?.trim()) return null;
  return "••••••••";
}
