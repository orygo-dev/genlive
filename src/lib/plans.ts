export type PlanCodeValue = "FREE" | "PRO";

export type PlanDefinition = {
  code: PlanCodeValue;
  name: string;
  priceIdr: number;
  billingPeriodDays: number;
  maxMembers: number;
  maxMeetingsPerMonth: number;
  maxMeetingMinutesPerMonth: number;
  maxRecordingMinutesPerMonth: number;
  features: string[];
};

export type PlanCatalog = Record<PlanCodeValue, PlanDefinition>;

export const DEFAULT_PLAN_CATALOG: PlanCatalog = {
  FREE: {
    code: "FREE",
    name: "Gratis",
    priceIdr: 0,
    billingPeriodDays: 0,
    maxMembers: 5,
    maxMeetingsPerMonth: 10,
    maxMeetingMinutesPerMonth: 300,
    maxRecordingMinutesPerMonth: 0,
    features: [
      "Hingga 5 anggota workspace",
      "10 meeting / bulan",
      "300 menit meeting / bulan",
      "Tanpa recording cloud",
    ],
  },
  PRO: {
    code: "PRO",
    name: "Pro",
    priceIdr: 149_000,
    billingPeriodDays: 30,
    maxMembers: 50,
    maxMeetingsPerMonth: 200,
    maxMeetingMinutesPerMonth: 5_000,
    maxRecordingMinutesPerMonth: 500,
    features: [
      "Hingga 50 anggota workspace",
      "200 meeting / bulan",
      "5.000 menit meeting / bulan",
      "500 menit recording / bulan",
      "Prioritas dukungan",
    ],
  },
};

/** @deprecated Prefer DEFAULT_PLAN_CATALOG; kept for compatibility */
export const PLANS = DEFAULT_PLAN_CATALOG;

function asPlan(
  code: PlanCodeValue,
  value: unknown,
  fallback: PlanDefinition,
): PlanDefinition {
  if (!value || typeof value !== "object") return fallback;
  const raw = value as Partial<PlanDefinition>;
  return {
    code,
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name : fallback.name,
    priceIdr:
      typeof raw.priceIdr === "number" && raw.priceIdr >= 0
        ? Math.round(raw.priceIdr)
        : fallback.priceIdr,
    billingPeriodDays:
      typeof raw.billingPeriodDays === "number" && raw.billingPeriodDays >= 0
        ? Math.round(raw.billingPeriodDays)
        : fallback.billingPeriodDays,
    maxMembers:
      typeof raw.maxMembers === "number" && raw.maxMembers > 0
        ? Math.round(raw.maxMembers)
        : fallback.maxMembers,
    maxMeetingsPerMonth:
      typeof raw.maxMeetingsPerMonth === "number" && raw.maxMeetingsPerMonth > 0
        ? Math.round(raw.maxMeetingsPerMonth)
        : fallback.maxMeetingsPerMonth,
    maxMeetingMinutesPerMonth:
      typeof raw.maxMeetingMinutesPerMonth === "number" &&
      raw.maxMeetingMinutesPerMonth >= 0
        ? Math.round(raw.maxMeetingMinutesPerMonth)
        : fallback.maxMeetingMinutesPerMonth,
    maxRecordingMinutesPerMonth:
      typeof raw.maxRecordingMinutesPerMonth === "number" &&
      raw.maxRecordingMinutesPerMonth >= 0
        ? Math.round(raw.maxRecordingMinutesPerMonth)
        : fallback.maxRecordingMinutesPerMonth,
    features: Array.isArray(raw.features)
      ? raw.features.filter((item): item is string => typeof item === "string")
      : fallback.features,
  };
}

export function normalizePlanCatalog(input: unknown): PlanCatalog {
  const raw =
    input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  return {
    FREE: asPlan("FREE", raw.FREE, DEFAULT_PLAN_CATALOG.FREE),
    PRO: asPlan("PRO", raw.PRO, DEFAULT_PLAN_CATALOG.PRO),
  };
}

export function getPlan(code: string | null | undefined): PlanDefinition {
  if (code === "PRO") {
    return DEFAULT_PLAN_CATALOG.PRO;
  }
  return DEFAULT_PLAN_CATALOG.FREE;
}

export function formatIdr(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}
