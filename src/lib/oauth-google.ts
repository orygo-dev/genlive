import "server-only";

import { getPlatformConfig } from "@/lib/platform-config";
import { absoluteUrl } from "@/lib/app-url";

export type GoogleTokenPayload = {
  sub: string;
  email: string;
  name: string;
  emailVerified: boolean;
};

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export async function getGoogleOAuthCredentials() {
  const config = await getPlatformConfig();
  return {
    clientId: config.googleClientId,
    clientSecret: config.googleClientSecret,
  };
}

export async function isGoogleOAuthConfigured() {
  const { clientId, clientSecret } = await getGoogleOAuthCredentials();
  return Boolean(clientId && clientSecret);
}

export async function getGoogleAuthUrl(state: string, requestOrigin?: string | null) {
  const { clientId } = await getGoogleOAuthCredentials();
  if (!clientId) {
    throw new Error("Google OAuth belum dikonfigurasi.");
  }

  const redirectUri = await absoluteUrl("/api/auth/google/callback", requestOrigin);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });

  const hostedDomain =
    process.env.GOOGLE_HOSTED_DOMAIN?.trim().toLowerCase() || "";
  if (hostedDomain) {
    params.set("hd", hostedDomain);
  }

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeGoogleCode(
  code: string,
  requestOrigin?: string | null,
): Promise<GoogleTokenPayload> {
  const { clientId, clientSecret } = await getGoogleOAuthCredentials();
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth belum dikonfigurasi.");
  }

  const redirectUri = await absoluteUrl("/api/auth/google/callback", requestOrigin);
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!tokenResponse.ok) {
    const detail = await tokenResponse.text().catch(() => "");
    throw new Error(`Gagal menukar kode Google OAuth. ${detail}`.trim());
  }

  const tokenJson = (await tokenResponse.json()) as { access_token?: string };
  if (!tokenJson.access_token) {
    throw new Error("Token Google tidak diterima.");
  }

  const userResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });

  if (!userResponse.ok) {
    throw new Error("Gagal mengambil profil Google.");
  }

  const profile = (await userResponse.json()) as {
    sub?: string;
    email?: string;
    name?: string;
    email_verified?: boolean;
  };

  if (!profile.sub || !profile.email) {
    throw new Error("Profil Google tidak lengkap.");
  }

  return {
    sub: profile.sub,
    email: profile.email.trim().toLowerCase(),
    name: profile.name?.trim() || profile.email.split("@")[0] || "Pengguna",
    emailVerified: Boolean(profile.email_verified),
  };
}

export function emailDomain(email: string) {
  const at = email.lastIndexOf("@");
  return at >= 0 ? email.slice(at + 1).toLowerCase() : "";
}

export function domainMatchesHint(email: string, hint: string) {
  const domain = emailDomain(email);
  const normalizedHint = hint.trim().toLowerCase().replace(/^@/, "");
  if (!normalizedHint) return true;
  return domain === normalizedHint || email.toLowerCase().endsWith(`@${normalizedHint}`);
}

export function assertGoogleHostedDomainAllowed(email: string) {
  const hostedDomain = process.env.GOOGLE_HOSTED_DOMAIN?.trim().toLowerCase();
  if (!hostedDomain) return;

  if (!domainMatchesHint(email, hostedDomain)) {
    throw new Error(
      `Akun Google harus menggunakan domain @${hostedDomain.replace(/^@/, "")}.`,
    );
  }
}

export async function assertOrgSsoDomainAllowed(
  email: string,
  organizationHints: Array<string | null | undefined>,
) {
  for (const hint of organizationHints) {
    if (!hint?.trim()) continue;
    if (!domainMatchesHint(email, hint)) {
      throw new Error(
        `Email harus menggunakan domain @${hint.replace(/^@/, "")} untuk workspace SSO ini.`,
      );
    }
  }
}
