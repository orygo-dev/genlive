import { describe, expect, it } from "vitest";
import {
  buildRecordingFilepath,
  mapEgressStatus,
  recordingStatusLabel,
} from "./recording-helpers";

describe("recording helpers", () => {
  it("builds nested recording filepaths", () => {
    expect(
      buildRecordingFilepath({
        organizationId: "org-1",
        meetingId: "meet-1",
        recordingId: "rec-1",
      }),
    ).toBe("recordings/org-1/meet-1/rec-1.mp4");
  });

  it("maps egress statuses to recording statuses", () => {
    expect(mapEgressStatus(0)).toBe("STARTING");
    expect(mapEgressStatus(1)).toBe("ACTIVE");
    expect(mapEgressStatus(2)).toBe("ENDING");
    expect(mapEgressStatus(3)).toBe("COMPLETE");
    expect(mapEgressStatus(4)).toBe("FAILED");
    expect(mapEgressStatus(5)).toBe("ABORTED");
    expect(mapEgressStatus(6)).toBe("FAILED");
  });

  it("labels recording statuses", () => {
    expect(recordingStatusLabel("ACTIVE")).toBe("Merekam");
    expect(recordingStatusLabel("COMPLETE")).toBe("Selesai");
  });
});
