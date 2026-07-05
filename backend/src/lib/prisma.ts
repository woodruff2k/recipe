import { PrismaClient } from "@prisma/client";

/**
 * Single shared PrismaClient instance.
 * In development we cache it on globalThis so ts-node-dev's hot reload
 * does not exhaust the connection pool by creating a new client per reload.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
