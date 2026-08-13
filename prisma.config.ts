import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

/*
 * This config is consumed by the Prisma CLI (migrate, studio), not by the
 * running application. The app connects through the driver adapter in
 * src/lib/db.ts using DATABASE_URL, Supabase's pooled connection.
 *
 * The CLI gets DIRECT_URL instead: Prisma Migrate takes advisory locks and
 * runs DDL in transactions, which a PgBouncer transaction pooler cannot serve
 * correctly. Prisma 7 dropped `datasource.directUrl`, so the separation is
 * expressed by pointing each consumer at the URL it needs.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DIRECT_URL'),
  },
})
