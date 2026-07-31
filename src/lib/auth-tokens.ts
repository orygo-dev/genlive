import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import type { AuthTokenType } from "@/generated/prisma/enums";

const TOKEN_TTL_MS: Record<AuthTokenType, number> = {
  EMAIL_VERIFY: 24 * 60 * 60 * 1000,
  PASSWORD_RESET: 60 * 60 * 1000,
};

function hashAuthToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createAuthToken(userId: string, type: AuthTokenType) {
  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS[type]);

  await prisma.authToken.create({
    data: {
      userId,
      type,
      tokenHash: hashAuthToken(rawToken),
      expiresAt,
    },
  });

  return rawToken;
}

export async function consumeAuthToken(rawToken: string, type: AuthTokenType) {
  const tokenHash = hashAuthToken(rawToken.trim());
  const now = new Date();

  const record = await prisma.authToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      type: true,
      expiresAt: true,
      consumedAt: true,
    },
  });

  if (!record || record.type !== type || record.consumedAt || record.expiresAt <= now) {
    return null;
  }

  await prisma.authToken.update({
    where: { id: record.id },
    data: { consumedAt: now },
  });

  return { userId: record.userId };
}
