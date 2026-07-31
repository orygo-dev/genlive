/**
 * Create or update a Super Admin user.
 *
 * Usage:
 *   node scripts/create-super-admin.mjs
 *   node scripts/create-super-admin.mjs email@domain.com 'YourPass1' 'Nama Admin'
 */
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { config as loadEnv } from "dotenv";
import { hash } from "bcryptjs";
import mariadb from "mariadb";

for (const path of [".env.local", ".env", ".env.production"]) {
  if (existsSync(path)) {
    loadEnv({ path });
  }
}

const email = (process.argv[2] || "admin@genlive.guruspaceai.cloud")
  .trim()
  .toLowerCase();
const password = process.argv[3] || "GenMeet@Admin2026";
const name = (process.argv[4] || "Super Admin").trim();

if (!process.env.DATABASE_URL?.trim()) {
  console.error("ERROR: DATABASE_URL belum ada. Isi .env.production dulu.");
  process.exit(1);
}

if (password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
  console.error(
    "ERROR: Password minimal 8 karakter, ada huruf kecil, kapital, dan angka.",
  );
  process.exit(1);
}

function parseMysqlUrl(raw) {
  const normalized = raw.replace(/^mysql:\/\//i, "http://");
  const url = new URL(normalized);
  return {
    host: url.hostname || "127.0.0.1",
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
  };
}

const db = parseMysqlUrl(process.env.DATABASE_URL);
const passwordHash = await hash(password, 12);
const id = randomUUID();

const conn = await mariadb.createConnection(db);
try {
  const existing = await conn.query(
    "SELECT id FROM users WHERE email = ? LIMIT 1",
    [email],
  );

  if (existing.length > 0) {
    await conn.query(
      `UPDATE users
       SET name = ?, password_hash = ?, is_super_admin = 1, updated_at = NOW(3)
       WHERE email = ?`,
      [name, passwordHash, email],
    );
    console.log(`Updated Super Admin: ${email}`);
  } else {
    await conn.query(
      `INSERT INTO users (id, name, email, password_hash, is_super_admin, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, NOW(3), NOW(3))`,
      [id, name, email, passwordHash],
    );
    console.log(`Created Super Admin: ${email}`);
  }

  console.log("");
  console.log("Login:");
  console.log(`  URL      : ${process.env.APP_URL || "https://genlive.guruspaceai.cloud"}/auth`);
  console.log(`  Email    : ${email}`);
  console.log(`  Password : ${password}`);
  console.log("");
  console.log("Pastikan di .env.production:");
  console.log(`  SUPER_ADMIN_EMAIL=${email}`);
  console.log("Lalu: cp .env.production .next/standalone/.env && pm2 restart genmeet");
} finally {
  await conn.end();
}
