import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    exclude: ['**/node_modules/**', '**/tests/e2e/**', '**/e2e/**', '**/dist/**', '.kilo/worktrees/**'],
  }
});