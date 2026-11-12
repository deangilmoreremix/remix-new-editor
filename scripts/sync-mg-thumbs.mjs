#!/usr/bin/env node
/**
 * Serves the motion-graphics template thumbnails. Every template in public/occ-templates/*-templates.json has a `thumb`
 * ("/thumbnails/<name>.jpg"); the images are tracked in apps/video-agent-studio/assets/thumbnails but this app never served them,
 * so the Add-to-timeline cards showed text only. Copies them to public/occ-templates/thumbs/<name>.jpg (generated, gitignored).
 * Run by `predev` and `build`. A template without an image still gets a live render in its card.
 */
import fs from 'node:fs'
import path from 'node:path'

const SRC = path.resolve('apps/video-agent-studio/assets/thumbnails')
const OUT = path.resolve('public/occ-templates/thumbs')
if (!fs.existsSync(SRC)) { console.log('sync-mg-thumbs: source folder missing, skipped'); process.exit(0) }
fs.mkdirSync(OUT, { recursive: true })
let n = 0
for (const f of fs.readdirSync(SRC)) {
  if (!/\.(jpe?g|png|webp)$/i.test(f)) continue
  const to = path.join(OUT, f)
  if (!fs.existsSync(to) || fs.statSync(to).size !== fs.statSync(path.join(SRC, f)).size) { fs.copyFileSync(path.join(SRC, f), to); n++ }
}
console.log(`sync-mg-thumbs: ${n} copied, ${fs.readdirSync(OUT).length} available -> public/occ-templates/thumbs`)
