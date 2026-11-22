import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { isAllowedMedia, mediaRoots } from './media-access.mjs'

const base = mkdtempSync(path.join(os.tmpdir(), 'vb-media-'))
const downloads = path.join(base, 'downloads')
const data = path.join(base, 'data')
const tmp = path.join(base, 'tmp')
for (const dir of [downloads, path.join(data, 'uploads'), path.join(data, 'html5-preview'), path.join(tmp, 'smartvid-html5-preview')]) mkdirSync(dir, { recursive: true })
const file = (...parts) => { const p = path.join(...parts); writeFileSync(p, 'x'); return p }
const roots = mediaRoots({ downloadPath: downloads, downloadDir: undefined, dataRoot: data, tmpDir: tmp })

test('download, upload and preview files are playable', () => {
  assert.equal(isAllowedMedia(file(downloads, 'a.mp4'), roots), true)
  assert.equal(isAllowedMedia(file(data, 'uploads', 'b.mp4'), roots), true)
  assert.equal(isAllowedMedia(file(data, 'html5-preview', 'c.mp4'), roots), true)
  assert.equal(isAllowedMedia(file(tmp, 'smartvid-html5-preview', 'd.mp4'), roots), true)
})

test('the rest of the data folder (database, settings) stays private', () => {
  assert.equal(isAllowedMedia(file(data, 'smartvid.db'), roots), false)
  assert.equal(isAllowedMedia(file(base, 'elsewhere.mp4'), roots), false)
})

test('a symlink inside an allowed folder cannot reach outside it', async () => {
  const { realpathSync } = await import('node:fs')
  const secret = file(data, 'settings.json')
  symlinkSync(secret, path.join(downloads, 'link.mp4'))
  assert.equal(isAllowedMedia(realpathSync(path.join(downloads, 'link.mp4')), roots), false)
})

test('a folder that does not exist yet is ignored, and unset roots are dropped', () => {
  assert.equal(isAllowedMedia(file(downloads, 'e.mp4'), [path.join(base, 'missing'), downloads]), true)
  assert.equal(mediaRoots({ dataRoot: data, tmpDir: tmp }).length, 3)
})
