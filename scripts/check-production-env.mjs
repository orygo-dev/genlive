import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";

for (const path of [".env.local", ".env", ".env.production"]) {
  if (existsSync(path)) {
    loadEnv({ path });
  }
}
loadEnv();
const strict = process.argv.includes("--strict");
const issues = [];

function has(key) {
  return Boolean(process.env[key]?.trim());
}

function requireValue(key, predicate, message) {
  const value = process.env[key]?.trim();
  if (!value || (predicate && !predicate(value))) {
    issues.push({ key, message, optional: false });
  }
}

requireValue(
  "APP_URL",
  (value) => {
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  },
  "APP_URL production harus URL HTTPS yang valid.",
);

requireValue("DATABASE_URL", null, "DATABASE_URL wajib diisi.");
requireValue(
  "LIVEKIT_URL",
  (value) => value.startsWith("wss://"),
  "LIVEKIT_URL harus diawali wss://.",
);
requireValue("LIVEKIT_API_KEY", null, "LIVEKIT_API_KEY wajib diisi.");
requireValue("LIVEKIT_API_SECRET", null, "LIVEKIT_API_SECRET wajib diisi.");

if (has("RESEND_API_KEY") && !has("EMAIL_FROM")) {
  issues.push({
    key: "EMAIL_FROM",
    optional: false,
    message: "EMAIL_FROM wajib diisi jika RESEND_API_KEY disetel.",
  });
}

const provider = (process.env.PAYMENT_PROVIDER || "MIDTRANS").toUpperCase();
const nodeEnv = process.env.NODE_ENV || "development";

if (provider === "MIDTRANS") {
  if (!has("MIDTRANS_SERVER_KEY") || !has("MIDTRANS_CLIENT_KEY")) {
    issues.push({
      key: "MIDTRANS",
      optional: true,
      message:
        "Untuk billing Midtrans, isi MIDTRANS_SERVER_KEY dan MIDTRANS_CLIENT_KEY (opsional jika billing belum dipakai).",
    });
  } else if (
    process.env.MIDTRANS_IS_PRODUCTION !== "true" &&
    nodeEnv === "production"
  ) {
    issues.push({
      key: "MIDTRANS_IS_PRODUCTION",
      optional: true,
      message:
        "Set MIDTRANS_IS_PRODUCTION=true saat go-live dengan kredensial production Midtrans.",
    });
  }
}

if (provider === "IPAYMU") {
  if (!has("IPAYMU_VA") || !has("IPAYMU_API_KEY")) {
    issues.push({
      key: "IPAYMU",
      optional: true,
      message:
        "Untuk billing iPaymu, isi IPAYMU_VA dan IPAYMU_API_KEY (opsional jika billing belum dipakai).",
    });
  } else if (
    process.env.IPAYMU_IS_PRODUCTION !== "true" &&
    nodeEnv === "production"
  ) {
    issues.push({
      key: "IPAYMU_IS_PRODUCTION",
      optional: true,
      message:
        "Set IPAYMU_IS_PRODUCTION=true saat go-live dengan kredensial production iPaymu.",
    });
  }
}

if (provider === "FLIP") {
  if (!has("FLIP_SECRET_KEY") || !has("FLIP_VALIDATION_TOKEN")) {
    issues.push({
      key: "FLIP",
      optional: true,
      message:
        "Untuk billing Flip, isi FLIP_SECRET_KEY dan FLIP_VALIDATION_TOKEN (opsional jika billing belum dipakai).",
    });
  } else if (
    process.env.FLIP_IS_PRODUCTION !== "true" &&
    nodeEnv === "production"
  ) {
    issues.push({
      key: "FLIP_IS_PRODUCTION",
      optional: true,
      message:
        "Set FLIP_IS_PRODUCTION=true saat go-live dengan kredensial production Flip.",
    });
  }
}

if (issues.length === 0) {
  console.log("Production env check: OK");
  process.exit(0);
}

console.log("Production env check: issues found");
for (const issue of issues) {
  const tag = issue.optional ? "optional" : "required";
  console.log(`- [${tag}] ${issue.key}: ${issue.message}`);
}

if (strict) {
  const blocking = issues.filter((issue) => !issue.optional);
  if (blocking.length > 0) {
    process.exit(1);
  }
}

process.exit(0);
