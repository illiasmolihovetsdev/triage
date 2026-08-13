import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

/*
 * Tests target server-side logic (claiming, authorization, notification
 * records) against a real PostgreSQL database, so the default environment is
 * node rather than a DOM emulation.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
