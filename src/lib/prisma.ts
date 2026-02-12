import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaPool: Pool | undefined;
};

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

function createPrismaClient() {
  const pool = new Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  return { prisma, pool };
}

const prismaClientInstance =
  globalForPrisma.prisma && globalForPrisma.prismaPool
    ? { prisma: globalForPrisma.prisma, pool: globalForPrisma.prismaPool }
    : createPrismaClient();

export const prisma = prismaClientInstance.prisma;

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prismaClientInstance.prisma;
  globalForPrisma.prismaPool = prismaClientInstance.pool;
}
