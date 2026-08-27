import { defineConfig } from 'vitest/config'

// Consolidated test configuration — replaces vitest.config.js and jest.config.cjs
// Unit tests in src/__tests__/ run in node env; component tests use jsdom.
export default defineConfig({
  test: {
    include: [
      'src/**/__tests__/**/*.test.{ts,mjs}',
      'src/lib/editor/__tests__/**/*.test.{js,ts}',
      'tests/unit/**/*.test.{js,ts}',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/tests/e2e/**',
      '**/e2e/**',
    ],
    environment: 'node',
    // Component tests that need DOM should specify it per-file with @vitest-environment jsdom
  },
})
