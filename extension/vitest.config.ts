import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/__tests__/**/*.test.ts'],
    // Provide build-time constants that esbuild normally injects
    define: {
      __SUPABASE_URL__: '"https://test.supabase.co"',
      __SUPABASE_ANON_KEY__: '"test-anon-key"',
      __SENTRY_DSN__: '""',
      __SENTRY_RELEASE__: '"test"',
      __ENVIRONMENT__: '"test"',
    },
  },
})
