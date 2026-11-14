// Runs the Stage 9 full-stack check (real route handlers + real video-events handler + REAL SQL on a throwaway local Postgres).
// Separate from the default suite because it needs `su postgres` access to a local Postgres 16: node run from the repo root:
//   npx vitest run --config scripts/stage12-e2e-check/vitest.stage12.config.mjs
import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export default defineConfig({
  root,
  test: { environment: 'node', include: ['scripts/stage12-e2e-check/*.stack.ts'], testTimeout: 120000, hookTimeout: 240000 },
  resolve: { alias: { '@ohb': path.resolve(root, 'src/features/personalization'), '@': root } },
})
