import { PrismaClient } from "@prisma/client";

// In dev, Next.js HMR creates new module contexts which can leak Prisma clients.
// Stash on globalThis so we reuse a single connection.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
