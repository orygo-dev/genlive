import { describe, expect, it } from "vitest";
import {
  findActiveLiveKitServer,
  normalizeLiveKitServerProfile,
  normalizeLiveKitServerProfiles,
} from "@/lib/livekit-config";

const cloud = {
  id: "cloud",
  name: "Cloud utama",
  kind: "CLOUD" as const,
  url: "https://example.livekit.cloud/",
  apiUrl: "",
  apiKey: " key-cloud ",
  apiSecret: " secret-cloud ",
};

describe("LiveKit multi-server configuration", () => {
  it("keeps URL, API URL, key, and secret as one normalized profile", () => {
    expect(normalizeLiveKitServerProfile(cloud)).toEqual({
      id: "cloud",
      name: "Cloud utama",
      kind: "CLOUD",
      url: "wss://example.livekit.cloud",
      apiUrl: "https://example.livekit.cloud",
      apiKey: "key-cloud",
      apiSecret: "secret-cloud",
    });
  });

  it("selects the requested active server", () => {
    const profiles = normalizeLiveKitServerProfiles([
      cloud,
      {
        id: "selfhosted",
        name: "Server lokal",
        kind: "SELF_HOSTED",
        url: "wss://meet.example.id",
        apiUrl: "https://meet.example.id",
        apiKey: "key-local",
        apiSecret: "secret-local",
      },
    ]);
    expect(findActiveLiveKitServer(profiles, "selfhosted")?.id).toBe(
      "selfhosted",
    );
  });

  it("rejects incomplete profiles instead of mixing credentials", () => {
    expect(
      normalizeLiveKitServerProfile({
        ...cloud,
        apiSecret: "",
      }),
    ).toBeNull();
  });
});
