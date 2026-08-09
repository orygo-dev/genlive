import { NextResponse } from "next/server";
import { appendFile, readFile, writeFile } from "node:fs/promises";
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

const MAX_EVENTS = 400;

function logPath() {
  return path.join(process.cwd(), "debug-a90ca2.log");
}

async function readAllEvents(): Promise<DebugEvent[]> {
  try {
    const raw = await readFile(logPath(), "utf8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as DebugEvent;
        } catch {
          return null;
        }
      })
      .filter((event): event is DebugEvent => Boolean(event))
      .slice(-MAX_EVENTS);
  } catch {
    return [];
  }
}

export async function GET() {
  const events = await readAllEvents();
  return NextResponse.json({
    ok: true,
    count: events.length,
    events,
  });
}

export async function DELETE() {
  try {
    await writeFile(logPath(), "", "utf8");
  } catch {
    // ignore
  }
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

  try {
    await appendFile(logPath(), `${JSON.stringify(event)}\n`, "utf8");
  } catch {
    // ignore read-only fs
  }

  return NextResponse.json({ ok: true });
}
