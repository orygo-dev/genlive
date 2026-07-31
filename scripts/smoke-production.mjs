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

const checks = [
  {
    path: "/api/health",
    expect: async (response, body) => {
      if (response.status !== 200) {
        return `health HTTP ${response.status}`;
      }
      if (!body || body.status !== "ok") {
        return `health status=${body?.status ?? "missing"}`;
      }
      if (body.checks?.database !== "ok") {
        return "database check failed";
      }
      if (body.checks?.livekitConfigured !== true) {
        return "livekit not configured";
      }
      if (body.checks?.appUrlConfigured !== true) {
        return "APP_URL not configured";
      }
      return null;
    },
  },
  {
    path: "/api/auth/google/status",
    expect: async (response, body) => {
      if (response.status !== 200) {
        return `google status HTTP ${response.status}`;
      }
      if (typeof body?.configured !== "boolean") {
        return "google status missing configured boolean";
      }
      return null;
    },
  },
  { path: "/terms", expectStatus: [200] },
  { path: "/privacy", expectStatus: [200] },
  { path: "/cookies", expectStatus: [200] },
  { path: "/dpa", expectStatus: [200] },
  { path: "/robots.txt", expectStatus: [200] },
  { path: "/manifest.webmanifest", expectStatus: [200] },
];

const failures = [];

for (const check of checks) {
  const url = new URL(check.path, baseUrl).toString();
  const started = Date.now();
  let response;
  let body = null;
  let text = "";

  try {
    response = await fetch(url, {
      headers: { Accept: "*/*" },
      redirect: "manual",
    });
    text = await response.text();
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  } catch (error) {
    failures.push(`${check.path}: network error (${error.message})`);
    console.log(`FAIL ${check.path} network`);
    continue;
  }

  const latencyMs = Date.now() - started;
  let error = null;

  if (typeof check.expect === "function") {
    error = await check.expect(response, body);
  } else if (check.expectStatus && !check.expectStatus.includes(response.status)) {
    error = `HTTP ${response.status}, expected ${check.expectStatus.join("|")}`;
  }

  if (error) {
    failures.push(`${check.path}: ${error}`);
    console.log(`FAIL ${check.path} status=${response.status} latencyMs=${latencyMs} — ${error}`);
  } else {
    const extra =
      check.path === "/api/health"
        ? ` status=${body?.status}`
        : check.path === "/api/auth/google/status"
          ? ` configured=${body?.configured}`
          : "";
    console.log(`OK   ${check.path} status=${response.status} latencyMs=${latencyMs}${extra}`);
  }
}

if (failures.length > 0) {
  console.error("\nSmoke check gagal:");
  for (const failure of failures) {
    console.error(` - ${failure}`);
  }
  process.exit(1);
}

console.log("\nSmoke check: OK");
