import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (p: string) => readFileSync(join(root, p), 'utf8')
const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')

function rules(css: string): { selector: string; body: string }[] {
  const out: { selector: string; body: string }[] = []
  for (const m of strip(css).matchAll(/([^{}@]+)\{([^{}]*)\}/g)) out.push({ selector: m[1].trim(), body: m[2] })
  return out
}
const bgOf = (body: string) => /(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/i.exec(body)?.[1].trim().toLowerCase()
const isTransparent = (v: string | undefined) => !v || /^(transparent|none|inherit|initial|unset)\b/.test(v)

describe('buttons are outline-only (no fills)', () => {
  it('loads the outline-buttons stylesheet from the app entry', () => {
    expect(read('src/main.js')).toMatch(/import\s+['"]\.\/styles\/outline-buttons\.css['"]/)
  })

  it('the override removes fills from buttons, including Tailwind utility fills, with !important', () => {
    const css = strip(read('src/styles/outline-buttons.css'))
    const base = rules(css).find((r) => /^button:not\(\[role="switch"\]\)/.test(r.selector))
    expect(base, 'base button rule').toBeTruthy()
    expect(base!.body).toMatch(/background-color:\s*transparent\s*!important/)
    expect(base!.body).toMatch(/background-image:\s*none\s*!important/)
  })

  it('the override never sets a fill on a button', () => {
    for (const r of rules(read('src/styles/outline-buttons.css'))) {
      const bg = bgOf(r.body)
      expect(isTransparent(bg), `${r.selector} sets background: ${bg}`).toBe(true)
    }
  })

  it('the shared button classes in global.css are transparent at rest and in every state', () => {
    const offenders = rules(read('src/styles/global.css'))
      .filter((r) => /(^|[\s,])\.btn-(personalize|action-secondary|primary-modern|secondary-modern)\b/.test(r.selector))
      .filter((r) => !isTransparent(bgOf(r.body)))
      .map((r) => `${r.selector} { background: ${bgOf(r.body)} }`)
    expect(offenders).toEqual([])
  })

  it('selected and primary states use the neon border and text, not a fill', () => {
    const css = strip(read('src/styles/outline-buttons.css'))
    expect(css).toMatch(/button\.active[\s\S]*?color:\s*var\(--ob-neon\)\s*!important/)
    expect(css).toMatch(/border:\s*1px solid var\(--ob-neon-border\)\s*!important/)
  })
})
