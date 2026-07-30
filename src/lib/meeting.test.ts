import { describe, expect, it } from "vitest";
import {
  createRoomName,
  meetingRequestSchema,
  normalizeRoomName,
} from "./meeting";

describe("normalizeRoomName", () => {
  it("creates a URL-safe room name", () => {
    expect(normalizeRoomName("  Weekly Product Sync!  ")).toBe(
      "weekly-product-sync",
    );
  });

  it("removes leading and trailing separators", () => {
    expect(normalizeRoomName("---GenMeet---")).toBe("genmeet");
  });
});

describe("meetingRequestSchema", () => {
  it("accepts a valid meeting request", () => {
    const result = meetingRequestSchema.safeParse({
      roomName: "weekly-sync-123",
      participantName: "Anisa Putri",
    });

    expect(result.success).toBe(true);
  });

  it("rejects unsafe room names", () => {
    const result = meetingRequestSchema.safeParse({
      roomName: "../private-room",
      participantName: "Anisa",
    });

    expect(result.success).toBe(false);
  });
});

describe("createRoomName", () => {
  it("creates unique valid room names", () => {
    const roomNames = new Set(Array.from({ length: 20 }, createRoomName));

    expect(roomNames.size).toBe(20);
    for (const roomName of roomNames) {
      expect(meetingRequestSchema.shape.roomName.safeParse(roomName).success).toBe(
        true,
      );
    }
  });
});
