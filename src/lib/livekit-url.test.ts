import { describe, expect, it } from "vitest";
import {
  classifyLiveKitFailure,
  deriveLivekitApiUrl,
  isLivekitCloudUrl,
  isValidLivekitUrl,
  normalizeLivekitApiUrl,
  normalizeLivekitUrl,
  sanitizeLivekitCredential,
} from "./livekit-url";

describe("livekit-url", () => {
  it("normalizes https paste to wss", () => {
    expect(normalizeLivekitUrl("https://myproj.livekit.cloud/")).toBe(
      "wss://myproj.livekit.cloud",
    );
  });

  it("keeps wss and strips slash", () => {
    expect(normalizeLivekitUrl("  wss://x.livekit.cloud/ ")).toBe(
      "wss://x.livekit.cloud",
    );
  });

  it("derives api url from wss", () => {
    expect(deriveLivekitApiUrl("wss://x.livekit.cloud")).toBe(
      "https://x.livekit.cloud",
    );
    expect(normalizeLivekitApiUrl("", "wss://x.livekit.cloud")).toBe(
      "https://x.livekit.cloud",
    );
  });

  it("forces Cloud API host from LIVEKIT_URL even if override provided", () => {
    expect(
      normalizeLivekitApiUrl("https://wrong.example.com", "wss://x.livekit.cloud", {
        kind: "CLOUD",
      }),
    ).toBe("https://x.livekit.cloud");
  });

  it("allows self-hosted API override", () => {
    expect(
      normalizeLivekitApiUrl("https://api.meet.local:7880", "wss://meet.local", {
        kind: "SELF_HOSTED",
      }),
    ).toBe("https://api.meet.local:7880");
  });

  it("detects cloud urls", () => {
    expect(isLivekitCloudUrl("wss://x.livekit.cloud")).toBe(true);
    expect(isLivekitCloudUrl("wss://meet.example.com")).toBe(false);
  });

  it("validates livekit urls", () => {
    expect(isValidLivekitUrl("wss://x.livekit.cloud")).toBe(true);
    expect(isValidLivekitUrl("https://x.livekit.cloud")).toBe(true);
    expect(isValidLivekitUrl("notaurl")).toBe(false);
  });

  it("sanitizes credentials including paste noise", () => {
    expect(sanitizeLivekitCredential('  "APIxxx"  ')).toBe("APIxxx");
    expect(sanitizeLivekitCredential("'secret'")).toBe("secret");
    expect(sanitizeLivekitCredential("API\r\nkey")).toBe("APIkey");
    expect(sanitizeLivekitCredential("")).toBeNull();
  });

  it("classifies LiveKit failures", () => {
    expect(
      classifyLiveKitFailure("unauthorized 401", {
        url: "wss://x.livekit.cloud",
      }).kind,
    ).toBe("unauthorized");
    expect(classifyLiveKitFailure("fetch failed ENOTFOUND").kind).toBe(
      "network",
    );
    expect(classifyLiveKitFailure("token is expired").kind).toBe(
      "expired_token",
    );
  });
});
