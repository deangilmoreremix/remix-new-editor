import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { RECAST_EXAMPLE } from '../advanced/FullBodyRecastPanel'

// The "See an example result" row in Full Body Recast points at files under
// public/. The character image and posters are .jpg, which the repo-wide
// `*.jpg` gitignore rule once dropped, leaving a broken image in production.
describe('Full Body Recast example media', () => {
  it.each(Object.entries(RECAST_EXAMPLE))('%s exists under public/', (_key, url) => {
    expect(existsSync(join(process.cwd(), 'public', url))).toBe(true)
  })

  it('is not ignored by git', async () => {
    const { execFileSync } = await import('node:child_process')
    const ignored = (file: string) => {
      try {
        execFileSync('git', ['check-ignore', '-q', file], { cwd: process.cwd() })
        return true // exit 0 = ignored
      } catch {
        return false
      }
    }
    for (const url of Object.values(RECAST_EXAMPLE)) {
      expect(ignored(join('public', url))).toBe(false)
    }
  })
})
