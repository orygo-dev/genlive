import { getPlatformConfig } from "@/lib/platform-config";

export async function getAppUrl(requestOrigin?: string | null) {
  const config = await getPlatformConfig();
  const configured = config.appUrl?.replace(/\/$/, "");
  if (configured) {
    return configured;
  }

  if (requestOrigin?.trim()) {
    return requestOrigin.trim().replace(/\/$/, "");
  }

  return "http://localhost:3000";
}

export async function absoluteUrl(path: string, requestOrigin?: string | null) {
  const base = await getAppUrl(requestOrigin);
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}
