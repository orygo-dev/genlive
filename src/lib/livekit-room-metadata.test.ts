import { describe, expect, it } from "vitest";
import {
  parseRoomMetadata,
  serializeRoomMetadata,
} from "./livekit-room-metadata";

describe("livekit room metadata", () => {
  it("parses locked flag", () => {
    expect(parseRoomMetadata('{"locked":true}')).toEqual({ locked: true });
    expect(parseRoomMetadata("{}")).toEqual({ locked: false });
    expect(parseRoomMetadata(null)).toEqual({});
    expect(parseRoomMetadata("not-json")).toEqual({});
  });

  it("parses breakout metadata", () => {
    expect(
      parseRoomMetadata('{"locked":false,"breakout":{"active":true,"endsAt":9}}'),
    ).toEqual({
      locked: false,
      breakout: { active: true, endsAt: 9 },
    });
  });

  it("merges lock patch without dropping other keys", () => {
    const next = serializeRoomMetadata('{"foo":1,"locked":false}', {
      locked: true,
    });
    expect(JSON.parse(next)).toEqual({ foo: 1, locked: true });
  });

  it("merges breakout patch without dropping lock", () => {
    const next = serializeRoomMetadata('{"locked":true}', {
      breakout: { active: true, endsAt: 100 },
    });
    expect(JSON.parse(next)).toEqual({
      locked: true,
      breakout: { active: true, endsAt: 100 },
    });
  });
});