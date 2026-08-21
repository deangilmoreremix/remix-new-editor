import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    // E2E specs are run by Playwright, not vitest (they need a browser + dev server).
    // Agent worktrees under .kilo are scratch space and must not be collected.
    exclude: ['**/node_modules/**', '**/tests/e2e/**', '**/e2e/**', '**/dist/**', '**/.kilo/**'],
  },
  resolve: {
    alias: {
      '../../lib/socialPublishHelpers': path.resolve(__dirname, 'src/lib/socialPublishHelpers.js'),
    },
  },
});