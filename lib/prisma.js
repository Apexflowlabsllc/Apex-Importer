// lib/prisma.js

import { PrismaClient } from '@prisma/client';

// This prevents Prisma from creating new connections on every hot-reload in development.
// It stores the Prisma Client on the global object, which persists across reloads.
const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    // Optional: You can add logging to see the queries Prisma is running.
    // log: ['query', 'info', 'warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;

