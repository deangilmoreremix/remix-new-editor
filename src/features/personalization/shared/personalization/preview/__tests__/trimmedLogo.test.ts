import { describe, expect, it } from 'vitest'
import { normalizeImageHints, createDefaultPreviewSettings } from '../presets'
import { buildPreviewInput } from '../../guided/buildPreviewInput'

const PNG = 'data:image/png;base64,iVBORw0KGgo='
const logo = (url: string) => ({ id: 'l1', role: 'logo', name: 'logo.png', url, isPrimary: true, createdAt: '' }) as never

describe('normalizeImageHints trimmedUrl', () => {
  it('keeps a bounded PNG data URL and drops everything else', () => {
    expect(normalizeImageHints({ 'https://x.com/l.png': { trimmedUrl: PNG } })?.['https://x.com/l.png']?.trimmedUrl).toBe(PNG)
    for (const bad of ['https://evil.com/x.png', 'javascript:alert(1)', 'data:text/html;base64,PHNjcmlwdD4=', 'data:image/svg+xml;base64,PHN2Zz4=', `data:image/png;base64,${'A'.repeat(200_001)}`]) {
      expect(normalizeImageHints({ 'https://x.com/l.png': { aspect: 2, trimmedUrl: bad } })?.['https://x.com/l.png']?.trimmedUrl).toBeUndefined()
    }
  })
})

describe('buildPreviewInput uses the trimmed logo', () => {
  const base = { source: null, previewVideo: null, clientForm: {} }
  it('swaps in the trimmed copy and leaves the original asset alone', () => {
    const settings = { ...createDefaultPreviewSettings(), imageHints: { 'https://x.com/l.png': { trimmedUrl: PNG } } }
    const assets = { logos: [], products: [], primaryLogo: logo('https://x.com/l.png') } as never
    const input = buildPreviewInput({ ...base, previewSettings: settings, assets })
    expect(input.brand.logoUrl).toBe(PNG)
    expect((assets as { primaryLogo: { url: string } }).primaryLogo.url).toBe('https://x.com/l.png')
  })
  it('uses the original when there is no trimmed copy, and null with no logo', () => {
    const assets = { logos: [], products: [], primaryLogo: logo('https://x.com/l.png') } as never
    expect(buildPreviewInput({ ...base, previewSettings: createDefaultPreviewSettings(), assets }).brand.logoUrl).toBe('https://x.com/l.png')
    expect(buildPreviewInput({ ...base, previewSettings: createDefaultPreviewSettings(), assets: { logos: [], products: [], primaryLogo: null } as never }).brand.logoUrl).toBeNull()
  })
})
