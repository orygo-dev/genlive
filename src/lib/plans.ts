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

export const PLANS: Record<PlanCodeValue, PlanDefinition> = {
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

export function getPlan(code: string | null | undefined): PlanDefinition {
  if (code === "PRO") {
    return PLANS.PRO;
  }
  return PLANS.FREE;
}

export function formatIdr(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}
