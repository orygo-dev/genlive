/** Debug-session camera toggle instrumentation (session a90ca2). */
export function dbgCamera(
  hypothesisId: string,
  location: string,
  message: string,
  data: Record<string, unknown> = {},
) {
  // #region agent log
  const payload = {
    sessionId: "a90ca2",
    runId: "cam-toggle-2",
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  };
  // Local Cursor ingest (works on http://localhost)
  fetch("http://127.0.0.1:7758/ingest/cf47dd30-7b6f-48f4-8e67-59c8a77569f7", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "a90ca2",
    },
    body: JSON.stringify(payload),
  }).catch(() => {});
  // Same-origin API (works on production HTTPS + local file append)
  fetch("/api/debug/cam-trace", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {});
  // #endregion
}
