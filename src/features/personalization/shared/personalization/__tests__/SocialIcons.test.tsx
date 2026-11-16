// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SocialIcons, socialHref } from '../SocialIcons'

describe('socialHref', () => {
  it('accepts profile URLs on the right host and plain handles', () => {
    expect(socialHref('instagram', 'https://www.instagram.com/joes/')).toBe('https://www.instagram.com/joes/')
    expect(socialHref('instagram', '@joes_plumbing')).toBe('https://www.instagram.com/joes_plumbing')
    expect(socialHref('facebook', 'joesplumbing')).toBe('https://www.facebook.com/joesplumbing')
  })
  it('rejects wrong hosts, share links, bare homepages, junk and non-http', () => {
    expect(socialHref('facebook', 'https://evil.com/facebook.com/x')).toBeNull()
    expect(socialHref('facebook', 'https://www.facebook.com/sharer/sharer.php?u=x')).toBeNull()
    expect(socialHref('instagram', 'https://instagram.com/')).toBeNull()
    expect(socialHref('tiktok', 'javascript:alert(1)')).toBeNull()
    expect(socialHref('youtube', 'has spaces!')).toBeNull()
    expect(socialHref('facebook', undefined)).toBeNull()
  })
})

describe('<SocialIcons />', () => {
  it('renders only the networks present, as safe labelled links', () => {
    render(<SocialIcons name="Joe's" links={{ instagram: 'https://instagram.com/joes', facebook: 'https://facebook.com/joes' }} />)
    const ig = screen.getByLabelText("Instagram page for Joe's")
    expect(ig.getAttribute('href')).toBe('https://instagram.com/joes')
    expect(ig.getAttribute('rel')).toBe('noopener noreferrer')
    expect(ig.getAttribute('target')).toBe('_blank')
    expect(screen.getByLabelText("Facebook page for Joe's")).toBeTruthy()
    expect(screen.queryByLabelText(/LinkedIn/)).toBeNull()
    expect(document.querySelectorAll('svg')).toHaveLength(2)
  })
  it('renders nothing when no valid link exists', () => {
    const { container } = render(<SocialIcons links={{ facebook: 'https://x.com/nope' }} />)
    expect(container.firstChild).toBeNull()
  })
  it('uses each network\'s brand colour, and a gradient for Instagram', () => {
    const { container } = render(<SocialIcons links={{ facebook: 'a1', linkedin: 'a1', youtube: 'a1', instagram: 'a1', tiktok: 'a1' }} />)
    const fills = (n: string) => [...container.querySelectorAll(`a[data-network="${n}"] path`)].map((p) => p.getAttribute('fill'))
    expect(fills('facebook')).toEqual(['#1877F2'])
    expect(fills('linkedin')).toEqual(['#0A66C2'])
    expect(fills('youtube')).toEqual(['#FF0000'])
    expect(fills('instagram')[0]).toMatch(/^url\(#ig-grad-[A-Za-z0-9_-]+\)$/)
    expect(container.querySelector('linearGradient')).toBeTruthy()
    expect(fills('tiktok')).toEqual(['#25F4EE', '#FE2C55', '#FFFFFF'])
  })
  it('is compact: 14px by default', () => {
    render(<SocialIcons links={{ facebook: 'a1' }} />)
    expect(document.querySelector('svg')!.getAttribute('width')).toBe('14')
  })
})
