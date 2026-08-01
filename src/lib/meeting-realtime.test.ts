import { describe, expect, it } from "vitest";
import {
  decodeMeetingMessage,
  encodeMeetingMessage,
  type MeetingRealtimeMessage,
} from "./meeting-realtime";

const samples: MeetingRealtimeMessage[] = [
  { type: "reaction", emoji: "👍", from: "Anisa", id: "r1" },
  {
    type: "poll_create",
    pollId: "p1",
    question: "Lanjut agenda?",
    options: ["Ya", "Tidak"],
    from: "Host",
  },
  { type: "poll_vote", pollId: "p1", optionIndex: 0, from: "Budi" },
  {
    type: "breakout",
    action: "join",
    roomName: "demo-bo-1",
    label: "Grup A",
  },
  {
    type: "breakout",
    action: "start",
    rooms: [
      { roomName: "demo-bo-1", label: "Grup 1" },
      { roomName: "demo-bo-2", label: "Grup 2" },
    ],
    assignments: [
      {
        identity: "user-a",
        roomName: "demo-bo-1",
        label: "Grup 1",
      },
    ],
    secondsLeft: 300,
  },
  { type: "breakout", action: "timer", secondsLeft: 42 },
  {
    type: "caption",
    text: "Halo semua",
    from: "Anisa",
    final: true,
    id: "c1",
  },
  {
    type: "wb_stroke",
    points: [0, 0, 10, 10],
    color: "#ffffff",
    width: 3,
    from: "Anisa",
  },
  { type: "wb_clear", from: "Host" },
];

describe("meeting-realtime", () => {
  it("roundtrips all message types", () => {
    for (const sample of samples) {
      const encoded = encodeMeetingMessage(sample);
      const decoded = decodeMeetingMessage(encoded);
      expect(decoded).toEqual(sample);
    }
  });

  it("returns null for invalid payloads", () => {
    expect(decodeMeetingMessage(new Uint8Array([0xff, 0xfe]))).toBeNull();
    expect(decodeMeetingMessage(encodeMeetingMessage({
      type: "reaction",
      emoji: "👍",
      from: "x",
      id: "1",
    }))).not.toBeNull();
    expect(
      decodeMeetingMessage(new TextEncoder().encode('{"type":"unknown"}')),
    ).toBeNull();
  });
});
