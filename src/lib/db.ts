import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL belum dikonfigurasi.");
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient(databaseUrl: string) {
  const adapter = new PrismaMariaDb(databaseUrl);
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });
}

// Cache on globalThis so serverless warm instances reuse one client.
export const prisma = globalForPrisma.prisma ?? createPrismaClient(connectionString);
globalForPrisma.prisma = prisma;
