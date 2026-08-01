export type RoomLockMetadata = {
  locked?: boolean;
  breakout?: {
    active: boolean;
    endsAt?: number;
  };
};

export function parseRoomMetadata(
  raw: string | undefined | null,
): RoomLockMetadata {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const record = parsed as {
      locked?: unknown;
      breakout?: {
        active?: unknown;
        endsAt?: unknown;
      };
    };
    const breakout =
      record.breakout && typeof record.breakout === "object"
        ? {
            active: Boolean(record.breakout.active),
            endsAt:
              typeof record.breakout.endsAt === "number"
                ? record.breakout.endsAt
                : undefined,
          }
        : undefined;
    return {
      locked: Boolean(record.locked),
      ...(breakout ? { breakout } : {}),
    };
  } catch {
    return {};
  }
}

export function serializeRoomMetadata(
  current: string | undefined | null,
  patch: RoomLockMetadata,
): string {
  let base: Record<string, unknown> = {};
  if (current) {
    try {
      const parsed = JSON.parse(current) as unknown;
      if (parsed && typeof parsed === "object") {
        base = { ...(parsed as Record<string, unknown>) };
      }
    } catch {
      base = {};
    }
  }
  if (typeof patch.locked === "boolean") {
    base.locked = patch.locked;
  }
  if (patch.breakout) {
    base.breakout = {
      active: Boolean(patch.breakout.active),
      ...(typeof patch.breakout.endsAt === "number"
        ? { endsAt: patch.breakout.endsAt }
        : {}),
    };
  }
  return JSON.stringify(base);
}
