import { config } from "dotenv";
import { existsSync } from "node:fs";
import { defineConfig, env } from "prisma/config";

// Load in priority order. Later files do not override already-set vars
// unless override is true — we load specific files first, then fallbacks.
for (const path of [".env.local", ".env", ".env.production"]) {
  if (existsSync(path)) {
    config({ path });
  }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
