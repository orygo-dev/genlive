import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { resolveActiveOrganization } from "@/lib/organization-helpers";

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_COOKIE_NAME =
  process.env.SESSION_COOKIE_NAME?.trim() || "genmeet_session";

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(
  userId: string,
  activeOrganizationId?: string | null,
) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await prisma.session.create({
    data: {
      tokenHash: hashSessionToken(token),
      userId,
      activeOrganizationId: activeOrganizationId ?? null,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function deleteCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await prisma.session.deleteMany({
      where: { tokenHash: hashSessionToken(token) },
    });
  }

  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

async function getSessionRecord() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    select: {
      id: true,
      expiresAt: true,
      activeOrganizationId: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          isSuperAdmin: true,
          isDisabled: true,
          emailVerifiedAt: true,
          memberships: {
            orderBy: { joinedAt: "asc" },
            select: {
              id: true,
              role: true,
              joinedAt: true,
              organization: {
                select: { id: true, name: true, slug: true },
              },
            },
          },
        },
      },
    },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt <= new Date()) {
    await prisma.session.deleteMany({ where: { id: session.id } });
    return null;
  }

  if (session.user.isDisabled) {
    await prisma.session.deleteMany({ where: { userId: session.user.id } });
    return null;
  }

  return session;
}

export async function getCurrentUser() {
  const session = await getSessionRecord();
  return session?.user ?? null;
}

export async function getCurrentSessionContext() {
  const session = await getSessionRecord();
  if (!session) {
    return null;
  }

  const activeMembership = resolveActiveOrganization(
    session.user,
    session.activeOrganizationId,
  );

  if (
    activeMembership &&
    session.activeOrganizationId !== activeMembership.organization.id
  ) {
    await prisma.session.update({
      where: { id: session.id },
      data: { activeOrganizationId: activeMembership.organization.id },
    });
  }

  return {
    sessionId: session.id,
    user: session.user,
    activeMembership,
  };
}

export async function setActiveOrganization(
  sessionId: string,
  organizationId: string,
) {
  await prisma.session.update({
    where: { id: sessionId },
    data: { activeOrganizationId: organizationId },
  });
}
