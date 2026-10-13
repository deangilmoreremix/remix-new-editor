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
    exclude: ['**/node_modules/**', '**/tests/e2e/**', '**/e2e/**', '**/dist/**', '**/.kilo/**', '**/tests/studio-demo/**', 'backend/__tests__/**', '__tests__/**', 'backend/tests/**'],
  },
  resolve: {
    alias: [
      // Deno-only import specifiers used by supabase/functions — stubbed so the
      // edge-function handlers can be unit-tested under Node/vitest.
      // (Additive: no existing module references these specifiers.)
      {
        find: 'jsr:@supabase/functions-js/edge-runtime.d.ts',
        replacement: path.resolve(__dirname, 'tests/unit/__stubs__/deno-edge-runtime.js'),
      },
      {
        find: /^npm:@supabase\/supabase-js@.*/,
        replacement: path.resolve(__dirname, 'tests/unit/__stubs__/supabase-js.js'),
      },
      {
        find: /^npm:openai@?.*/,
        replacement: path.resolve(__dirname, 'tests/unit/__stubs__/openai.js'),
      },
      {
        find: 'npm:./_registry.js',
        replacement: path.resolve(__dirname, 'tests/unit/__stubs__/thumbnail-registry.js'),
      },
      {
        find: '../../lib/socialPublishHelpers',
        replacement: path.resolve(__dirname, 'src/lib/socialPublishHelpers.js'),
      },
    ],
  },
});