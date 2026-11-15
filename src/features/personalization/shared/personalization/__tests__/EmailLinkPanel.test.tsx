// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import EmailLinkPanel from '../EmailLinkPanel'
import { mergeTagLink, tokensInText, isUnreplacedMergeTag, EMAIL_PROVIDERS } from '../emailMergeLink'

const BASE = 'https://watch.example/v/abc'

describe('emailMergeLink', () => {
  it('builds provider tags and skips image tokens', () => {
    expect(mergeTagLink(BASE, ['firstName', 'email'], 'mailchimp').link).toBe(`${BASE}?firstName=*|FNAME|*&email=*|EMAIL|*`)
    expect(mergeTagLink(BASE, ['firstName'], 'klaviyo').link).toBe(`${BASE}?firstName={{ first_name }}`)
    const r = mergeTagLink(`${BASE}?x=1`, ['firstName', 'logoUrl', 'painPoint'], 'custom', { preload: false })
    expect(r.skipped).toEqual(['logoUrl'])
    expect(r.link).toBe(`${BASE}?x=1&preload=none&firstName={{firstName}}&painPoint={{painPoint}}`)
    expect(mergeTagLink(BASE, ['painPoint'], 'mailchimp').unmapped).toEqual(['painPoint'])
    expect(() => mergeTagLink(BASE, ['firstName'], 'nope')).toThrow()
    expect(EMAIL_PROVIDERS.length).toBeGreaterThan(10)
  })
  it('extracts tokens from text with aliases, defaults and de-duplication', () => {
    expect(tokensInText('Hi {{first name}}, {{d company "there"}} and {{firstName}} {{up title}}')).toEqual(['firstName', 'company', 'title'])
    expect(tokensInText('')).toEqual([])
  })
  it('recognises unreplaced tags only', () => {
    expect(isUnreplacedMergeTag('*|FNAME|*')).toBe(true)
    expect(isUnreplacedMergeTag('Ann')).toBe(false)
  })
})

describe('EmailLinkPanel', () => {
  beforeEach(() => { cleanup(); try { window.localStorage.clear() } catch { /* ignore */ } })

  it('explains how to get merge tags when the prompt has no tokens', () => {
    render(<EmailLinkPanel tokens={[]} />)
    expect(screen.getByTestId('pz-email-empty')).toBeTruthy()
  })
  it('needs a valid https link, then shows the provider-specific link and copies it', async () => {
    const writeText = vi.fn(async () => {})
    Object.assign(navigator, { clipboard: { writeText } })
    render(<EmailLinkPanel tokens={['firstName', 'company']} />)
    expect(screen.queryByTestId('pz-email-link')).toBeNull()
    fireEvent.change(screen.getByTestId('pz-email-base'), { target: { value: 'not a url' } })
    expect(screen.queryByTestId('pz-email-link')).toBeNull()
    fireEvent.change(screen.getByTestId('pz-email-base'), { target: { value: BASE } })
    expect(screen.getByTestId('pz-email-link').textContent).toBe(`${BASE}?firstName=*|FNAME|*&company=*|COMPANY|*`)
    fireEvent.change(screen.getByTestId('pz-email-provider'), { target: { value: 'klaviyo' } })
    expect(screen.getByTestId('pz-email-link').textContent).toContain('firstName={{ first_name }}')
    fireEvent.click(screen.getByText('Copy link'))
    await Promise.resolve()
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('{{ first_name }}'))
  })
  it('remembers the video link', () => {
    const { unmount } = render(<EmailLinkPanel tokens={['firstName']} />)
    fireEvent.change(screen.getByTestId('pz-email-base'), { target: { value: BASE } })
    unmount()
    render(<EmailLinkPanel tokens={['firstName']} />)
    expect((screen.getByTestId('pz-email-base') as HTMLInputElement).value).toBe(BASE)
  })
})
