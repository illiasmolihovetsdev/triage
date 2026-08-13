import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/generated/prisma/client'

/*
 * One PrismaClient per process.
 *
 * Each instance owns a connection pool. Next.js clears the module registry on
 * every hot reload in development, so without this global the dev server would
 * open a new pool on each edit and exhaust the database's connection limit.
 */
const createPrismaClient = () => {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })

  return new PrismaClient({ adapter })
}

const globalForPrisma = globalThis as unknown as {
  prismaClient: PrismaClient | undefined
}

export const prisma = globalForPrisma.prismaClient ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prismaClient = prisma
}
