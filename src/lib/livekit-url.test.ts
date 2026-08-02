import { describe, expect, it } from "vitest";
import {
  isValidLivekitUrl,
  normalizeLivekitApiUrl,
  normalizeLivekitUrl,
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
    expect(normalizeLivekitApiUrl("", "wss://x.livekit.cloud")).toBe(
      "https://x.livekit.cloud",
    );
  });

  it("validates livekit urls", () => {
    expect(isValidLivekitUrl("wss://x.livekit.cloud")).toBe(true);
    expect(isValidLivekitUrl("https://x.livekit.cloud")).toBe(true);
    expect(isValidLivekitUrl("notaurl")).toBe(false);
  });
});
