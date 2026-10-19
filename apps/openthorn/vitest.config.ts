import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.{ts,mjs}'],
    // Only process __tests__ directory files, skip the rest of src/
    exclude: [
      '**/node_modules/**',
      'src/pages/**',
      'src/components/**',
    ],
    environment: 'node',
    setupFiles: ['./src/test-setup.ts'],
    testTimeout: 30_000,
  },
})
