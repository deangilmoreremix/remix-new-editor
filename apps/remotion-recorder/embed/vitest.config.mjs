// Runs upstream's own tests (apps/remotion-recorder/tests, byte-identical to remotion-dev/recorder) with vitest instead of bun:
//   npm run test:remotion-recorder
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export default defineConfig({
  root: appRoot,
  resolve: { alias: { 'bun:test': 'vitest' } }, // upstream imports { expect, test } from "bun:test"; the API is the same
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
