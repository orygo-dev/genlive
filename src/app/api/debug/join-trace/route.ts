import { NextResponse } from "next/server";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DebugEvent = {
  sessionId?: string;
  location?: string;
  message?: string;
  data?: Record<string, unknown>;
  hypothesisId?: string;
  timestamp?: number;
};

const MAX_EVENTS = 200;
const globalStore = globalThis as typeof globalThis & {
  __genmeetJoinDebug?: DebugEvent[];
};

function store() {
  if (!globalStore.__genmeetJoinDebug) {
    globalStore.__genmeetJoinDebug = [];
  }
  return globalStore.__genmeetJoinDebug;
}

async function appendLocalNdjson(event: DebugEvent) {
  try {
    const root = process.cwd();
    const file = path.join(root, "debug-a90ca2.log");
    await mkdir(root, { recursive: true });
    await appendFile(file, `${JSON.stringify(event)}\n`, "utf8");
  } catch {
    // Production may be read-only — memory store is enough there.
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as DebugEvent | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const event: DebugEvent = {
    sessionId: body.sessionId || "a90ca2",
    location: String(body.location || ""),
    message: String(body.message || ""),
    data: body.data && typeof body.data === "object" ? body.data : {},
    hypothesisId: body.hypothesisId ? String(body.hypothesisId) : undefined,
    timestamp: Number(body.timestamp) || Date.now(),
  };
  const events = store();
  events.push(event);
  if (events.length > MAX_EVENTS) {
    events.splice(0, events.length - MAX_EVENTS);
  }
  await appendLocalNdjson(event);
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    count: store().length,
    events: store().slice(-100),
  });
}

export async function DELETE() {
  globalStore.__genmeetJoinDebug = [];
  return NextResponse.json({ ok: true });
}
