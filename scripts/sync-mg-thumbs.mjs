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
if (!fs.existsSync(SRC)) { console.warn('sync-mg-thumbs: WARNING source folder missing (' + SRC + '), no thumbnails copied; Motion graphics cards fall back to a live render.'); process.exit(0) }
fs.mkdirSync(OUT, { recursive: true })
let n = 0
for (const f of fs.readdirSync(SRC)) {
  if (!/\.(jpe?g|png|webp)$/i.test(f)) continue
  const to = path.join(OUT, f)
  if (!fs.existsSync(to) || !fs.readFileSync(to).equals(fs.readFileSync(path.join(SRC, f)))) { fs.copyFileSync(path.join(SRC, f), to); n++ } // by content: a replaced picture with the same byte length is still copied
}
// remove copies whose source file no longer exists, so a deleted thumbnail does not linger
const have = new Set(fs.readdirSync(SRC));
let pruned = 0;
for (const f of fs.readdirSync(OUT)) if (!have.has(f)) { fs.rmSync(path.join(OUT, f)); pruned++ }
console.log(`sync-mg-thumbs: ${n} copied, ${pruned} pruned, ${fs.readdirSync(OUT).length} available -> public/occ-templates/thumbs`)
