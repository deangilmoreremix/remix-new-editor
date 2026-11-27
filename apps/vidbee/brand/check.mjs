// Dry run of the rebrand (nothing is written): applies brand/rebrand.mjs to every source file the builds would brand,
// fails if a patch no longer matches, and lists the upstream name wherever it is still left in code (comments skipped).
// Usage: node apps/vidbee/brand/check.mjs [--out <dir>]   (--out writes the rebranded copies there for inspection)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { brand, isBranded, rebrandSource } from './rebrand.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outIdx = process.argv.indexOf('--out')
const outDir = outIdx > 0 ? path.resolve(process.argv[outIdx + 1]) : null
const word = new RegExp(`\\b${brand.upstream.name}\\b`)
const files = []
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.') || e.name === 'out-web' || e.name === 'dist') continue
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p)
    else if (isBranded(p)) files.push(p)
  }
}
for (const d of ['apps/desktop/src', 'packages', 'skills']) walk(path.join(root, d))

let changed = 0
const left = []
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8')
  const out = rebrandSource(src, f)
  if (out !== src) changed++
  if (outDir) {
    const dest = path.join(outDir, path.relative(root, f))
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.writeFileSync(dest, out)
  }
  out.split('\n').forEach((line, i) => {
    const code = line.replace(/^\s*(\*|\/\/|\/\*).*$/, '').replace(/\s\/\/\s.*$/, '')
    if (word.test(code)) left.push(`${path.relative(root, f)}:${i + 1}: ${line.trim().slice(0, 160)}`)
  })
}
console.log(`${files.length} files checked, ${changed} rebranded, all patches applied.`)
console.log(`${left.length} lines still contain "${brand.upstream.name}" (protected identifiers, links, attribution):`)
for (const l of left) console.log(`  ${l}`)
