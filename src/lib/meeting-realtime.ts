export type MeetingRealtimeMessage =
  | { type: "reaction"; emoji: string; from: string; id: string }
  | {
      type: "poll_create";
      pollId: string;
      question: string;
      options: string[];
      from: string;
    }
  | { type: "poll_vote"; pollId: string; optionIndex: number; from: string }
  | {
      type: "breakout";
      action: "join" | "return" | "start" | "timer";
      roomName?: string;
      label?: string;
      rooms?: { roomName: string; label: string }[];
      assignments?: { identity: string; roomName: string; label: string }[];
      secondsLeft?: number;
    }
  | {
      type: "wb_stroke";
      points: number[];
      color: string;
      width: number;
      from: string;
    }
  | { type: "wb_clear"; from: string }
  | {
      type: "caption";
      text: string;
      from: string;
      final: boolean;
      id: string;
    };

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function isBreakoutRooms(
  value: unknown,
): value is { roomName: string; label: string }[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        typeof (entry as { roomName?: unknown }).roomName === "string" &&
        typeof (entry as { label?: unknown }).label === "string",
    )
  );
}

function isBreakoutAssignments(
  value: unknown,
): value is { identity: string; roomName: string; label: string }[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        typeof (entry as { identity?: unknown }).identity === "string" &&
        typeof (entry as { roomName?: unknown }).roomName === "string" &&
        typeof (entry as { label?: unknown }).label === "string",
    )
  );
}

function isMeetingRealtimeMessage(value: unknown): value is MeetingRealtimeMessage {
  if (!value || typeof value !== "object" || !("type" in value)) {
    return false;
  }

  const msg = value as { type: string };
  switch (msg.type) {
    case "reaction":
      return (
        typeof (value as { emoji?: unknown }).emoji === "string" &&
        typeof (value as { from?: unknown }).from === "string" &&
        typeof (value as { id?: unknown }).id === "string"
      );
    case "poll_create":
      return (
        typeof (value as { pollId?: unknown }).pollId === "string" &&
        typeof (value as { question?: unknown }).question === "string" &&
        Array.isArray((value as { options?: unknown }).options) &&
        typeof (value as { from?: unknown }).from === "string"
      );
    case "poll_vote":
      return (
        typeof (value as { pollId?: unknown }).pollId === "string" &&
        typeof (value as { optionIndex?: unknown }).optionIndex === "number" &&
        typeof (value as { from?: unknown }).from === "string"
      );
    case "breakout": {
      const action = (value as { action?: unknown }).action;
      if (
        action !== "join" &&
        action !== "return" &&
        action !== "start" &&
        action !== "timer"
      ) {
        return false;
      }
      if (action === "join" || action === "return") {
        return typeof (value as { roomName?: unknown }).roomName === "string";
      }
      if (action === "start") {
        const rooms = (value as { rooms?: unknown }).rooms;
        const assignments = (value as { assignments?: unknown }).assignments;
        return (
          (rooms === undefined || isBreakoutRooms(rooms)) &&
          (assignments === undefined || isBreakoutAssignments(assignments))
        );
      }
      return (
        typeof (value as { secondsLeft?: unknown }).secondsLeft === "number"
      );
    }
    case "wb_stroke":
      return (
        Array.isArray((value as { points?: unknown }).points) &&
        typeof (value as { color?: unknown }).color === "string" &&
        typeof (value as { width?: unknown }).width === "number" &&
        typeof (value as { from?: unknown }).from === "string"
      );
    case "wb_clear":
      return typeof (value as { from?: unknown }).from === "string";
    case "caption":
      return (
        typeof (value as { text?: unknown }).text === "string" &&
        typeof (value as { from?: unknown }).from === "string" &&
        typeof (value as { final?: unknown }).final === "boolean" &&
        typeof (value as { id?: unknown }).id === "string"
      );
    default:
      return false;
  }
}

export function encodeMeetingMessage(
  msg: MeetingRealtimeMessage,
): Uint8Array<ArrayBuffer> {
  // TextEncoder.encode is typed as ArrayBufferLike; LiveKit publishData wants ArrayBuffer.
  return encoder.encode(JSON.stringify(msg)) as Uint8Array<ArrayBuffer>;
}

export function decodeMeetingMessage(
  data: Uint8Array,
): MeetingRealtimeMessage | null {
  try {
    const parsed: unknown = JSON.parse(decoder.decode(data));
    return isMeetingRealtimeMessage(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
