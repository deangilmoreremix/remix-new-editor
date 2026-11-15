#!/usr/bin/env node
// Confirms emailProviders.json is byte-identical in remix-new-editor and OpenHiggsBolt.
// Usage: node scripts/check-email-providers-sync.mjs <path-to-the-other-repo>
import { readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, resolve } from 'node:path'

const PATHS = ['src/lib/editor/personalize/emailProviders.json', 'src/shared/personalization/emailProviders.json']
const find = (root) => PATHS.map((p) => join(root, p)).find((p) => existsSync(p))
const other = process.argv[2]
if (!other) { console.error('Usage: node scripts/check-email-providers-sync.mjs <path-to-the-other-repo>'); process.exit(2) }
const mine = find(process.cwd())
const theirs = find(resolve(other))
if (!mine || !theirs) { console.error(`emailProviders.json not found (this repo: ${mine || 'no'}, other: ${theirs || 'no'})`); process.exit(2) }
const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex')
const a = sha(mine), b = sha(theirs)
if (a === b) { console.log(`OK: emailProviders.json is identical (${a.slice(0, 12)})`); process.exit(0) }
console.error(`DIFFERENT:\n  ${mine} ${a.slice(0, 12)}\n  ${theirs} ${b.slice(0, 12)}\nCopy the newer file over the older one.`)
process.exit(1)
