import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const base = mkdtempSync(path.join(os.tmpdir(), 'vb-pdf-'))
process.env.VIDBEE_DATA_DIR = path.join(base, 'data')
process.env.VIDBEE_DOWNLOAD_DIR = path.join(base, 'dl')
const { BrowserWindow } = await import('./electron-stub.mjs')

test('printing to PDF fails with a clear message instead of returning nothing', async () => {
  const win = new BrowserWindow({})
  await assert.rejects(() => win.webContents.printToPDF({}), /PDF export is not available in the web edition/)
})

test('the rest of the window shim stays tolerant', async () => {
  const win = new BrowserWindow({})
  assert.equal(await win.webContents.executeJavaScript('1+1'), undefined)
})
