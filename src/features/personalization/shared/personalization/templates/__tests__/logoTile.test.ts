import { describe, it, expect } from 'vitest'
import { rveLogoBrand } from '../designs/batch3d/rveLogoShared'
import type { RemotionDesignComponentProps } from '../types'

function props(over: Partial<RemotionDesignComponentProps>): RemotionDesignComponentProps {
  return {
    text: 'Acme', textSlots: { companyName: 'Acme', businessName: 'Acme' },
    colors: { primary: '#29d3f2', accent: '#28c98b', text: '#ffffff', backgroundDim: 0.18 },
    media: { logo: 'https://example.com/logo.png', product: null, service: null },
    box: { leftPx: 0, topPx: 0, widthPx: 1920, heightPx: 1080 },
    width: 1920, height: 1080, frame: 0, fps: 30, opacity: 1, color: '#ffffff',
    ...over,
  } as RemotionDesignComponentProps
}

describe('logo tile behind a real logo', () => {
  it('is white for an ordinary logo', () => {
    expect(rveLogoBrand(props({})).badgeBackground).toBe('#ffffff')
  })
  it('is a dark brand tile for a white / pale logo, so it does not vanish', () => {
    const bg = rveLogoBrand(props({ logoIsLight: true })).badgeBackground
    expect(bg).not.toBe('#ffffff')
    expect(bg).toMatch(/^linear-gradient\(/)
  })
  it('without a logo it is still the brand gradient', () => {
    const bg = rveLogoBrand(props({ media: { logo: null, product: null, service: null } })).badgeBackground
    expect(bg).toBe('linear-gradient(135deg, #29d3f2, #28c98b)')
  })
})
