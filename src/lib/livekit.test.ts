import { describe, expect, it } from "vitest";
import { sanitizeLivekitCredential } from "./livekit-url";

describe("sanitizeLivekitCredential (livekit.test)", () => {
  it("works", () => {
    expect(sanitizeLivekitCredential('"x"')).toBe("x");
  });
});
