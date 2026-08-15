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
    include: ['tests/**/*.test.ts'],
    passWithNoTests: true,
    setupFiles: [fileURLToPath(new URL('./vitest.setup.ts', import.meta.url))],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'server-only': fileURLToPath(new URL('./vitest.server-only.ts', import.meta.url)),
    },
  },
})
