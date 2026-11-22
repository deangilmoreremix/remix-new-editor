import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vb-mf-'))
process.env.SMARTVID_DOWNLOAD_DIR = path.join(root, 'dl')
delete process.env.SMARTVID_DATA_DIR
process.env.HOME = root

test('private data inside the download dir is not served', async () => {
  const { resolveReadableMediaFile } = await import('../src/lib/managed-files.ts')
  const { apiDataDir, apiDefaultDownloadDir } = await import('../src/lib/api-paths.ts')
  fs.mkdirSync(apiDefaultDownloadDir, { recursive: true })
  const media = path.join(apiDefaultDownloadDir, 'a.mp4')
  fs.writeFileSync(media, 'x')
  const secret = path.join(apiDataDir, 'ai-settings.json')
  fs.mkdirSync(apiDataDir, { recursive: true })
  fs.writeFileSync(secret, '{"apiKey":"sk"}')
  assert.equal(await resolveReadableMediaFile(media), media)
  assert.equal(await resolveReadableMediaFile(secret), null)
})
