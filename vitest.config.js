// This root config file is not covered by the src/** globals block in
// eslint.config.js; declare the Node global it uses (Vite shims it at load
// time, so it is available at runtime despite the flat config).
/* global __dirname */
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    // The default 5s testTimeout is too tight for async/fetch-loop suites (e.g. the
    // apps/openthorn agent tests) under full-suite CPU contention; they pass quickly
    // in isolation but flake past 5s when every worker competes for the machine.
    // Raising the timeout is non-weakening — no assertion changes — and mirrors the
    // per-mount headroom added for studio-smoke.
    testTimeout: 30000,
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
    exclude: ['**/node_modules/**', '**/tests/e2e/**', '**/e2e/**', '**/dist/**', '**/.kilo/**', '**/tests/studio-demo/**', 'backend/__tests__/**', '__tests__/**', 'backend/tests/**', 'apps/vimax/**', 'apps/cinegen/**', '.agents/skills/media-use/**', '**/.git/**'],
  },
  resolve: {
    alias: {
      '../../lib/socialPublishHelpers': path.resolve(__dirname, 'src/lib/socialPublishHelpers.js'),
      // tests/unit/timeline-*.unit.spec.ts import through the `@/` layout:
      // `@` is the PROJECT ROOT, so `@/src/components/Timeline` resolves to
      // src/components/Timeline.js and `@/components/base/Component` to
      // components/base/Component.js (the base class the components import
      // via their own relative specifier — one module instance, so
      // `instanceof` holds). Vite only matches a string alias when the
      // importee equals it or starts with it + '/', so scoped packages such
      // as @clerk/*, @supabase/* and @vue/* are unaffected.
      '@': path.resolve(__dirname),
    },
  },
});