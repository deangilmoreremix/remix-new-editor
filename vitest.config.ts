import { defineConfig } from 'vitest/config'

// Consolidated test configuration — replaces vitest.config.js and jest.config.cjs
// Unit tests in src/__tests__/ run in node env; component tests use jsdom.
export default defineConfig({
  test: {
    include: [
      'src/**/__tests__/**/*.test.{ts,mjs}',
      'src/lib/editor/__tests__/**/*.test.{js,ts}',
      'src/test/**/*.test.{js,jsx,ts,tsx}',
      'tests/unit/**/*.test.{js,ts}',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/tests/e2e/**',
      '**/e2e/**',
    ],
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    // Component tests that need DOM should specify it per-file with @vitest-environment jsdom
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/e2e/**',
        '**/tests/e2e/**',
        'src/test/setup.ts',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
})
