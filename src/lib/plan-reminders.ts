import "server-only";

import { absoluteUrl } from "@/lib/app-url";
import { prisma } from "@/lib/db";
import { buildPlanExpiryReminderEmail } from "@/lib/email-templates";
import { sendEmail } from "@/lib/email";
import { logger } from "@/lib/logger";
import { getPlatformBranding } from "@/lib/platform-settings";
import type { PlanReminderKind } from "@/generated/prisma/enums";

const WINDOW_MS = 15 * 60 * 1000;

function windowForOffset(now: Date, offsetMs: number) {
  const center = now.getTime() + offsetMs;
  return {
    from: new Date(center - WINDOW_MS),
    to: new Date(center + 60_000),
  };
}

function periodKeyFromExpiry(expiresAt: Date) {
  return expiresAt.toISOString().slice(0, 10);
}

function daysLeftForKind(kind: PlanReminderKind) {
  switch (kind) {
    case "T_MINUS_7D":
      return 7;
    case "T_MINUS_3D":
      return 3;
    case "T_MINUS_1D":
      return 1;
    default:
      return 0;
  }
}

export async function processPlanReminders(now = new Date()) {
  const branding = await getPlatformBranding();
  const renewUrl = await absoluteUrl("/dashboard/billing");

  const kinds: Array<{ kind: PlanReminderKind; offsetMs: number }> = [
    { kind: "T_MINUS_7D", offsetMs: 7 * 24 * 60 * 60 * 1000 },
    { kind: "T_MINUS_3D", offsetMs: 3 * 24 * 60 * 60 * 1000 },
    { kind: "T_MINUS_1D", offsetMs: 24 * 60 * 60 * 1000 },
    { kind: "EXPIRED", offsetMs: 0 },
  ];

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const details: Array<{
    organizationId: string;
    kind: string;
    recipient: string;
    status: string;
  }> = [];

  for (const item of kinds) {
    const range = windowForOffset(now, item.offsetMs);
    const organizations = await prisma.organization.findMany({
      where: {
        planCode: "PRO",
        planExpiresAt: {
          not: null,
          gte: range.from,
          lte: range.to,
        },
      },
      select: {
        id: true,
        name: true,
        planExpiresAt: true,
        memberships: {
          where: { role: "OWNER" },
          select: {
            user: { select: { email: true, name: true } },
          },
        },
      },
    });

    for (const org of organizations) {
      if (!org.planExpiresAt) {
        continue;
      }

      const periodKey = periodKeyFromExpiry(org.planExpiresAt);
      const existing = await prisma.planReminderLog.findUnique({
        where: {
          organizationId_kind_periodKey: {
            organizationId: org.id,
            kind: item.kind,
            periodKey,
          },
        },
        select: { id: true },
      });
      if (existing) {
        skipped += 1;
        continue;
      }

      const owners = org.memberships.map((membership) => membership.user);
      if (owners.length === 0) {
        skipped += 1;
        continue;
      }

      const daysLeft = daysLeftForKind(item.kind);
      const email = buildPlanExpiryReminderEmail({
        appName: branding.appName,
        orgName: org.name,
        daysLeft,
        renewUrl,
        expiresAt: org.planExpiresAt,
        kind: item.kind,
      });

      let anySent = false;
      for (const owner of owners) {
        try {
          const result = await sendEmail({
            to: owner.email,
            subject: email.subject,
            html: email.html,
            text: email.text,
          });
          details.push({
            organizationId: org.id,
            kind: item.kind,
            recipient: owner.email,
            status: result.ok ? "sent" : "failed",
          });
          if (result.ok) {
            sent += 1;
            anySent = true;
          } else {
            failed += 1;
          }
        } catch (error) {
          failed += 1;
          logger.warn("Plan reminder email failed", {
            organizationId: org.id,
            kind: item.kind,
            recipient: owner.email,
            error: error instanceof Error ? error.message : String(error),
          });
          details.push({
            organizationId: org.id,
            kind: item.kind,
            recipient: owner.email,
            status: "failed",
          });
        }
      }

      if (anySent) {
        await prisma.planReminderLog.create({
          data: {
            organizationId: org.id,
            kind: item.kind,
            periodKey,
          },
        });
      }
    }
  }

  return { sent, failed, skipped, details };
}
