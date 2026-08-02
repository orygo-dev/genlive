import { describe, expect, it } from "vitest";
import { idealDeviceId, pickPreferredDeviceId } from "./media-devices";

describe("media-devices helpers", () => {
  it("picks preferred device when present", () => {
    expect(
      pickPreferredDeviceId(
        [
          { deviceId: "a", label: "A" },
          { deviceId: "b", label: "B" },
        ],
        "b",
      ),
    ).toBe("b");
  });

  it("falls back to first device", () => {
    expect(
      pickPreferredDeviceId([{ deviceId: "a", label: "A" }], "missing"),
    ).toBe("a");
  });

  it("builds ideal device constraint", () => {
    expect(idealDeviceId("cam-1")).toEqual({ ideal: "cam-1" });
    expect(idealDeviceId("")).toBeUndefined();
    expect(idealDeviceId("default")).toBeUndefined();
  });
});
