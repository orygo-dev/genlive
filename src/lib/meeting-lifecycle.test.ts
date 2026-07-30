import { describe, expect, it } from "vitest";
import {
  accumulateDuration,
  isFutureStart,
  isParticipantRoomOpen,
} from "./meeting-lifecycle";

describe("meeting lifecycle", () => {
  it("keeps participants out until the host activates a scheduled room", () => {
    expect(isParticipantRoomOpen("SCHEDULED")).toBe(false);
    expect(isParticipantRoomOpen("ACTIVE")).toBe(true);
    expect(isParticipantRoomOpen("ENDED")).toBe(false);
    expect(isParticipantRoomOpen("CANCELLED")).toBe(false);
  });

  it("classifies every future timestamp as scheduled", () => {
    const now = new Date("2026-07-26T08:00:00.000Z");
    expect(isFutureStart(new Date("2026-07-26T08:00:00.001Z"), now)).toBe(true);
    expect(isFutureStart(now, now)).toBe(false);
  });

  it("does not invent duration when no join was confirmed", () => {
    expect(accumulateDuration(12, null, new Date())).toBe(12);
  });

  it("accumulates duration across reconnects", () => {
    const joinedAt = new Date("2026-07-26T08:00:00.000Z");
    const leftAt = new Date("2026-07-26T08:00:15.000Z");
    expect(accumulateDuration(20, joinedAt, leftAt)).toBe(35);
  });

  it("never subtracts duration for out-of-order timestamps", () => {
    const joinedAt = new Date("2026-07-26T08:00:15.000Z");
    const leftAt = new Date("2026-07-26T08:00:00.000Z");
    expect(accumulateDuration(20, joinedAt, leftAt)).toBe(20);
  });
});
