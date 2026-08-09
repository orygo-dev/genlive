import { NextResponse } from "next/server";
import { appendFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DebugEvent = {
  sessionId?: string;
  runId?: string;
  hypothesisId?: string;
  location?: string;
  message?: string;
  data?: Record<string, unknown>;
  timestamp?: number;
};

const MAX_EVENTS = 300;
const globalStore = globalThis as typeof globalThis & {
  __genmeetCamDebug?: DebugEvent[];
};

function store() {
  if (!globalStore.__genmeetCamDebug) {
    globalStore.__genmeetCamDebug = [];
  }
  return globalStore.__genmeetCamDebug;
}

async function appendLocal(event: DebugEvent) {
  try {
    const filePath = path.join(process.cwd(), "debug-a90ca2.log");
    await appendFile(filePath, `${JSON.stringify(event)}\n`, "utf8");
  } catch {
    // ignore — production may be read-only
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    count: store().length,
    events: store(),
  });
}

export async function DELETE() {
  globalStore.__genmeetCamDebug = [];
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  let body: DebugEvent = {};
  try {
    body = (await request.json()) as DebugEvent;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const event: DebugEvent = {
    sessionId: body.sessionId ?? "a90ca2",
    runId: body.runId ?? "cam-toggle",
    hypothesisId: body.hypothesisId,
    location: body.location,
    message: body.message,
    data: body.data ?? {},
    timestamp: body.timestamp ?? Date.now(),
  };

  const events = store();
  events.push(event);
  if (events.length > MAX_EVENTS) {
    events.splice(0, events.length - MAX_EVENTS);
  }
  await appendLocal(event);

  return NextResponse.json({ ok: true });
}
