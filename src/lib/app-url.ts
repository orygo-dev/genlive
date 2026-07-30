export function getAppUrl(requestOrigin?: string | null) {
  const configured = process.env.APP_URL?.trim().replace(/\/$/, "");
  if (configured) {
    return configured;
  }

  if (requestOrigin?.trim()) {
    return requestOrigin.trim().replace(/\/$/, "");
  }

  return "http://localhost:3000";
}

export function absoluteUrl(path: string, requestOrigin?: string | null) {
  const base = getAppUrl(requestOrigin);
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}
