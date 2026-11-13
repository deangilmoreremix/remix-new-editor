// Type-checks the Personalization tree with tsconfig.stage1.json and FAILS on any error inside it.
// The program also pulls in vendored/legacy files the tree imports (src/cinegen, netlify shims, ...); their errors are
// pre-existing, are not part of this gate, and are printed as a count so they are never hidden.
// Usage: npm run typecheck:personalization
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SCOPE = 'src/features/personalization/shared/personalization/'
const run = spawnSync('npx', ['tsc', '-p', 'tsconfig.stage1.json', '--pretty', 'false'], {
  cwd: repo,
  encoding: 'utf8',
  env: { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --max-old-space-size=8192`.trim() },
  maxBuffer: 256 * 1024 * 1024,
})
if (run.error) { console.error(run.error); process.exit(2) }
const lines = `${run.stdout}\n${run.stderr}`.split('\n').filter((l) => /error TS\d+/.test(l))
const inScope = lines.filter((l) => l.startsWith(SCOPE))
const outside = lines.length - inScope.length
for (const l of inScope) console.log(l)
console.log(`typecheck:personalization — ${inScope.length} error(s) in ${SCOPE}; ${outside} pre-existing error(s) in imported vendored/legacy files are not part of this gate.`)
process.exit(inScope.length === 0 ? 0 : 1)
