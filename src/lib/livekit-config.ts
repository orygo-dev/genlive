import {
  normalizeLivekitApiUrl,
  normalizeLivekitUrl,
  sanitizeLivekitCredential,
} from "@/lib/livekit-url";

export type LiveKitServerKind = "CLOUD" | "SELF_HOSTED";

export type LiveKitServerProfile = {
  id: string;
  name: string;
  kind: LiveKitServerKind;
  url: string;
  apiUrl: string;
  apiKey: string;
  apiSecret: string;
};

export function normalizeLiveKitServerProfile(
  input: Partial<LiveKitServerProfile>,
): LiveKitServerProfile | null {
  const id = input.id?.trim();
  const name = input.name?.trim();
  const url = normalizeLivekitUrl(input.url);
  const apiUrl = normalizeLivekitApiUrl(input.apiUrl, url);
  const apiKey = sanitizeLivekitCredential(input.apiKey);
  const apiSecret = sanitizeLivekitCredential(input.apiSecret);
  if (!id || !name || !url || !apiUrl || !apiKey || !apiSecret) return null;

  return {
    id,
    name,
    kind: input.kind === "SELF_HOSTED" ? "SELF_HOSTED" : "CLOUD",
    url,
    apiUrl,
    apiKey,
    apiSecret,
  };
}

export function normalizeLiveKitServerProfiles(
  input: Array<Partial<LiveKitServerProfile>> | null | undefined,
) {
  const seen = new Set<string>();
  const profiles: LiveKitServerProfile[] = [];
  for (const item of input ?? []) {
    const profile = normalizeLiveKitServerProfile(item);
    if (!profile || seen.has(profile.id)) continue;
    seen.add(profile.id);
    profiles.push(profile);
  }
  return profiles;
}

export function findActiveLiveKitServer(
  profiles: LiveKitServerProfile[],
  activeId: string | null | undefined,
) {
  if (profiles.length === 0) return null;
  return profiles.find((profile) => profile.id === activeId) ?? profiles[0];
}
