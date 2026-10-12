import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    // E2E specs are run by Playwright, not vitest (they need a browser + dev server).
    // Agent worktrees under .kilo are scratch space and must not be collected.
    // Backend Jest suites live under backend/__tests__ and root __tests__; keep them out of vitest.
    // Backend vitest suites under backend/tests need backend-only deps; run from that package.
    // apps/vimax/frontend is a separate Create React App (own package.json: `react-scripts test`,
    // own setupTests.js, own testing-library). Its CRA/jsdom-jest tests must not be collected by
    // this root Vitest (they need react-scripts' babel/jest transform, not Vite). Exclude the whole
    // package so it runs under its own toolchain instead of failing to parse here.
    // .agents/skills/media-use/scripts tests are Node test-runner scripts (`node:test`) plus a custom
    // self-executing harness (not Vitest suites); they run/pass via `node --test`, so keep them out of
    // this Vitest collector. **/.git/** is never test source — exclude it defensively.
    exclude: ['**/node_modules/**', '**/tests/e2e/**', '**/e2e/**', '**/dist/**', '**/.kilo/**', '**/tests/studio-demo/**', 'backend/__tests__/**', '__tests__/**', 'backend/tests/**', 'apps/vimax/**', '.agents/skills/media-use/**', '**/.git/**'],
  },
  resolve: {
    alias: {
      '../../lib/socialPublishHelpers': path.resolve(__dirname, 'src/lib/socialPublishHelpers.js'),
    },
  },
});