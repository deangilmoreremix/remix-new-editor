import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { resolveExportFile } from './export-path.mjs'

const exportsDir = mkdtempSync(path.join(os.tmpdir(), 'vb-exports-'))
const id = '6f1c2f9e-1234-4abc-8def-000000000001'
const other = '6f1c2f9e-1234-4abc-8def-000000000002'
mkdirSync(path.join(exportsDir, id))
mkdirSync(path.join(exportsDir, other))
writeFileSync(path.join(exportsDir, id, '日本語 🎬.txt'), 'x')
writeFileSync(path.join(exportsDir, id, 'plain.srt'), 'x')
writeFileSync(path.join(exportsDir, other, 'secret.txt'), 'x')
writeFileSync(path.join(exportsDir, 'top.txt'), 'x')

test('finds a file saved under a Unicode name (it used to be looked up as "_.txt")', () => {
  assert.equal(resolveExportFile(exportsDir, id, encodeURIComponent('日本語 🎬.txt')), path.join(exportsDir, id, '日本語 🎬.txt'))
  assert.equal(resolveExportFile(exportsDir, id, 'plain.srt'), path.join(exportsDir, id, 'plain.srt'))
})

test('cannot reach outside the export folder', () => {
  for (const name of ['../top.txt', '..%2Ftop.txt', `..%2F${other}%2Fsecret.txt`, '/etc/passwd', '%2Fetc%2Fpasswd', '..', '.', '', 'a%00.txt']) {
    assert.equal(resolveExportFile(exportsDir, id, name), null, name)
  }
  // a different export's file is only reachable through its own id
  assert.equal(resolveExportFile(exportsDir, id, 'secret.txt'), null)
  assert.equal(resolveExportFile(exportsDir, other, 'secret.txt'), path.join(exportsDir, other, 'secret.txt'))
})

test('malformed input, bad ids and missing files give null instead of throwing', () => {
  assert.equal(resolveExportFile(exportsDir, id, '%'), null)
  assert.equal(resolveExportFile(exportsDir, id, '%E0%A4%A'), null)
  assert.equal(resolveExportFile(exportsDir, 'not-a-uuid', 'plain.srt'), null)
  assert.equal(resolveExportFile(exportsDir, id, 'missing.txt'), null)
})
