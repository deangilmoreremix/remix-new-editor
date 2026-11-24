import assert from 'node:assert/strict'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

process.env.VIDBEE_DATA_DIR = mkdtempSync(path.join(os.tmpdir(), 'sv-eng-'))
const { discardBrokenManagedBinary, resolveYtDlpPath } = await import('../src/lib/engines.ts')
const managed = path.join(process.env.VIDBEE_DATA_DIR, 'bin', 'yt-dlp')

test('a managed yt-dlp that cannot run is removed so the working one is used', async () => {
  mkdirSync(path.dirname(managed), { recursive: true })
  writeFileSync(managed, 'not a program')
  chmodSync(managed, 0o755)
  assert.equal(existsSync(managed), true)
  assert.equal(await discardBrokenManagedBinary(), true)
  assert.equal(existsSync(managed), false)
})

test('a managed yt-dlp that runs is kept', async () => {
  writeFileSync(managed, '#!/bin/sh\necho 2099.01.01\n')
  chmodSync(managed, 0o755)
  assert.equal(await discardBrokenManagedBinary(), false)
  assert.equal(existsSync(managed), true)
  assert.equal(resolveYtDlpPath(), managed)
})
