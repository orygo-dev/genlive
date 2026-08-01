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
      action: "join" | "return";
      roomName: string;
      label?: string;
    }
  | {
      type: "wb_stroke";
      points: number[];
      color: string;
      width: number;
      from: string;
    }
  | { type: "wb_clear"; from: string };

const encoder = new TextEncoder();
const decoder = new TextDecoder();

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
    case "breakout":
      return (
        ((value as { action?: unknown }).action === "join" ||
          (value as { action?: unknown }).action === "return") &&
        typeof (value as { roomName?: unknown }).roomName === "string"
      );
    case "wb_stroke":
      return (
        Array.isArray((value as { points?: unknown }).points) &&
        typeof (value as { color?: unknown }).color === "string" &&
        typeof (value as { width?: unknown }).width === "number" &&
        typeof (value as { from?: unknown }).from === "string"
      );
    case "wb_clear":
      return typeof (value as { from?: unknown }).from === "string";
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
