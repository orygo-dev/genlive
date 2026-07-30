/**
 * Smoke check untuk instance GenMeet yang sudah di-deploy.
 *
 * Usage:
 *   npm run smoke -- https://domain-anda.com
 *   node scripts/smoke-production.mjs https://domain-anda.com
 */

const baseArg = process.argv[2] || process.env.APP_URL || "http://localhost:3000";

let baseUrl;
try {
  baseUrl = new URL(baseArg);
} catch {
  console.error("URL tidak valid. Contoh: npm run smoke -- https://app.example.com");
  process.exit(1);
}

const healthUrl = new URL("/api/health", baseUrl).toString();
const started = Date.now();

const response = await fetch(healthUrl, {
  headers: { Accept: "application/json" },
  redirect: "manual",
});

const latencyMs = Date.now() - started;
let body = null;
try {
  body = await response.json();
} catch {
  body = null;
}

const ok =
  response.status === 200 &&
  body &&
  body.status === "ok" &&
  body.checks?.database === "ok" &&
  body.checks?.livekitConfigured === true &&
  body.checks?.appUrlConfigured === true;

console.log(`GET ${healthUrl}`);
console.log(`status=${response.status} latencyMs=${latencyMs}`);
console.log(JSON.stringify(body, null, 2));

if (!ok) {
  console.error("Smoke check gagal.");
  process.exit(1);
}

console.log("Smoke check: OK");
