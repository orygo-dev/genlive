import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { maintenanceBlockResponse } from "@/lib/maintenance";
import {
  assertGoogleHostedDomainAllowed,
  assertOrgSsoDomainAllowed,
  exchangeGoogleCode,
} from "@/lib/oauth-google";
import { syncSuperAdminFlag } from "@/lib/super-admin";

export const runtime = "nodejs";

const STATE_COOKIE = "google_oauth_state";

function authErrorRedirect(message: string) {
  const params = new URLSearchParams({ error: message });
  return NextResponse.redirect(`/auth?${params.toString()}`);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const error = searchParams.get("error");
  if (error) {
    return authErrorRedirect("Login Google dibatalkan atau gagal.");
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const cookieStore = await cookies();
  const savedState = cookieStore.get(STATE_COOKIE)?.value;

  cookieStore.set(STATE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/google",
    maxAge: 0,
  });

  if (!code || !state || !savedState || state !== savedState) {
    return authErrorRedirect("Sesi login Google tidak valid. Coba lagi.");
  }

  try {
    const profile = await exchangeGoogleCode(code, request.headers.get("origin"));
    assertGoogleHostedDomainAllowed(profile.email);

    let user = await prisma.user.findFirst({
      where: {
        OR: [{ googleSub: profile.sub }, { email: profile.email }],
      },
      select: {
        id: true,
        name: true,
        email: true,
        googleSub: true,
        isSuperAdmin: true,
        isDisabled: true,
        memberships: {
          orderBy: { joinedAt: "asc" },
          select: {
            organizationId: true,
            organization: {
              select: {
                ssoEnabled: true,
                ssoTenantHint: true,
              },
            },
          },
        },
      },
    });

    if (user) {
      const ssoHints = user.memberships
        .filter((m) => m.organization.ssoEnabled && m.organization.ssoTenantHint)
        .map((m) => m.organization.ssoTenantHint);
      await assertOrgSsoDomainAllowed(profile.email, ssoHints);

      if (user.isDisabled) {
        return authErrorRedirect("Akun dinonaktifkan. Hubungi Super Admin.");
      }

      const updateData: {
        googleSub?: string;
        emailVerifiedAt?: Date;
        name?: string;
      } = {};

      if (!user.googleSub) updateData.googleSub = profile.sub;
      if (profile.emailVerified) updateData.emailVerifiedAt = new Date();
      if (profile.name && profile.name !== user.name) updateData.name = profile.name;

      if (Object.keys(updateData).length > 0) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: updateData,
          select: {
            id: true,
            name: true,
            email: true,
            googleSub: true,
            isSuperAdmin: true,
            isDisabled: true,
            memberships: {
              orderBy: { joinedAt: "asc" },
              select: {
                organizationId: true,
                organization: {
                  select: {
                    ssoEnabled: true,
                    ssoTenantHint: true,
                  },
                },
              },
            },
          },
        });
      }
    } else {
      user = await prisma.user.create({
        data: {
          name: profile.name.slice(0, 80),
          email: profile.email,
          googleSub: profile.sub,
          emailVerifiedAt: profile.emailVerified ? new Date() : null,
        },
        select: {
          id: true,
          name: true,
          email: true,
          googleSub: true,
          isSuperAdmin: true,
          isDisabled: true,
          memberships: {
            orderBy: { joinedAt: "asc" },
            select: {
              organizationId: true,
              organization: {
                select: {
                  ssoEnabled: true,
                  ssoTenantHint: true,
                },
              },
            },
          },
        },
      });
    }

    const syncedSuperAdmin = await syncSuperAdminFlag(user.id, user.email);
    const isSuperAdmin = syncedSuperAdmin || user.isSuperAdmin;

    if (!isSuperAdmin) {
      const maintenance = await maintenanceBlockResponse();
      if (maintenance) {
        return authErrorRedirect("Platform sedang maintenance. Coba lagi nanti.");
      }
    }

    await createSession(user.id, user.memberships[0]?.organizationId);

    if (isSuperAdmin && user.memberships.length === 0) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    if (user.memberships.length === 0) {
      return NextResponse.redirect(new URL("/dashboard/workspaces/new", request.url));
    }

    return NextResponse.redirect(new URL("/dashboard", request.url));
  } catch (callbackError) {
    console.error("Google OAuth callback failed", callbackError);
    const message =
      callbackError instanceof Error
        ? callbackError.message
        : "Login Google gagal.";
    return authErrorRedirect(message);
  }
}
