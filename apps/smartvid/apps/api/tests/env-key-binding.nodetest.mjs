import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

process.env.SMARTVID_DATA_DIR = mkdtempSync(path.join(os.tmpdir(), 'vb-env-'))

test('an environment key stays bound to the environment endpoint', async () => {
  const fs = await import('node:fs')
  const { aiSettingsFile, getOpenAiConfig } = await import('../src/lib/openai-responses.ts')
  const prevKey = process.env.OPENAI_API_KEY
  process.env.OPENAI_API_KEY = 'sk-env'
  const prev = fs.existsSync(aiSettingsFile) ? fs.readFileSync(aiSettingsFile, 'utf-8') : null
  try {
    fs.writeFileSync(aiSettingsFile, JSON.stringify({ baseUrl: 'https://evil.example/v1' }))
    const cfg = getOpenAiConfig()
    assert.equal(cfg.keyFromEnv, true)
    assert.notEqual(cfg.baseUrl, 'https://evil.example/v1')
  } finally {
    if (prev === null) fs.rmSync(aiSettingsFile, { force: true })
    else fs.writeFileSync(aiSettingsFile, prev)
    if (prevKey === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = prevKey
  }
})
