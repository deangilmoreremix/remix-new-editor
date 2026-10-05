import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    exclude: [
      '**/node_modules/**',
      '**/tests/e2e/**',
      '**/e2e/**',
      '**/dist/**',
      '**/.kilo/**',
      '**/tests/studio-demo/**',
      '**/backend/**',
      '**/apps/openthorn/**',
      '**/.agents/**',
      '**/apps/vimax/**',
      '**/__tests__/core.test.js',
      '**/__tests__/thumbnailModalFlow.test.js',
      '**/src/components/Canvas.test.js',
      '**/tests/unit/timeline-*.unit.spec.ts',
      '**/src/lib/editor/__tests__/ai-integration.test.js',
    ],
  },
  resolve: {
    alias: {
      '../../lib/socialPublishHelpers': path.resolve(__dirname, 'src/lib/socialPublishHelpers.js'),
    },
  },
});