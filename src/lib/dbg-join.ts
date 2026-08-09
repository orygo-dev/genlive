/** Debug-mode ingest helper — remove after join-freeze investigation. */
export function dbgJoin(
  location: string,
  message: string,
  data: Record<string, unknown> = {},
  hypothesisId?: string,
) {
  const payload = {
    sessionId: "a90ca2",
    location,
    message,
    data,
    hypothesisId,
    timestamp: Date.now(),
  };
  // #region agent log
  // Local Cursor ingest (when browser and Cursor share the machine).
  fetch("http://127.0.0.1:7758/ingest/cf47dd30-7b6f-48f4-8e67-59c8a77569f7", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "a90ca2",
    },
    body: JSON.stringify(payload),
  }).catch(() => {});
  // Same-origin API so production/local both retain traces we can fetch.
  fetch("/api/debug/join-trace", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {});
  // #endregion
}
