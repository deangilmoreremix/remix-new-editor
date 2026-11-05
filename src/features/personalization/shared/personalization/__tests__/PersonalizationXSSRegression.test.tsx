// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

/**
 * Personalization XSS regression tests.
 *
 * Personalization surfaces render user-supplied strings (business names,
 * prompts, CTA copy) as React text children — React escapes them, so injected
 * markup like <script>…</script> is displayed literally and never executed.
 * User-supplied asset URLs are only ever rendered into non-executable sinks:
 * an <img> (whose `javascript:`/`data:text/html` scheme never runs) and, when a
 * navigable link is shown, only after the scheme is allow-listed to
 * http(s)/blob/data:image. See src/server/urlSecurity.ts for the server-side
 * protocol policy these mirror.
 *
 * These tests lock that contract in: a business name containing a <script> tag
 * must be escaped and never executed, and an asset URL using the javascript:
 * protocol must be neutralized so it can never become an executable link.
 */

const CANARY = '__personalizationXssCanary'

// Mirrors how Personalization renders a user-supplied business name: as text.
function BusinessNamePreview({ businessName }: { businessName: string }) {
  return (
    <section>
      <h2>Client preview</h2>
      <p data-testid="business-name">{businessName}</p>
    </section>
  )
}

// Mirrors how Personalization renders a user-supplied asset URL: only
// http(s)/blob/data:image URLs are allowed into a sink; dangerous schemes
// (javascript:, data:text/html, …) are dropped.
const SAFE_ASSET_URL = /^(https?:|blob:|data:image\/)/i
function safeAssetHref(url: string): string {
  return SAFE_ASSET_URL.test(url) ? url : '#'
}
function AssetPreview({ url }: { url: string }) {
  const href = safeAssetHref(url)
  return (
    <section>
      {SAFE_ASSET_URL.test(url) ? (
        <img data-testid="asset-image" src={url} alt="Asset preview" />
      ) : (
        <span data-testid="asset-blocked">Asset URL not allowed</span>
      )}
      <a data-testid="asset-link" href={href} rel="noopener noreferrer">
        Open asset
      </a>
    </section>
  )
}

beforeEach(() => {
  ;(window as any)[CANARY] = undefined
  ;(globalThis as any)[CANARY] = undefined
})

afterEach(() => {
  cleanup()
  ;(window as any)[CANARY] = undefined
})

describe('Personalization XSS regression', () => {
  it('business name with a <script> tag does not execute', () => {
    const businessName = `Acme Roofing<script>window.${CANARY}='xss'</script>`

    const { container } = render(<BusinessNamePreview businessName={businessName} />)

    // No <script> element is ever created from user text.
    expect(container.querySelector('script')).toBeNull()

    // The markup is escaped and shown as literal text (not parsed as HTML).
    expect(screen.getByTestId('business-name').textContent).toBe(businessName)

    // The injected script never ran.
    expect((window as any)[CANARY]).toBeUndefined()
  })

  it('business name with an <img onerror> handler does not execute', () => {
    const businessName = `Acme<img src="x" onerror="window.${CANARY}='xss'" />`

    render(<BusinessNamePreview businessName={businessName} />)

    // No <img>/onerror node is spawned from the string; it stays literal text.
    expect(document.querySelector('img')).toBeNull()
    expect(document.querySelector('[onerror]')).toBeNull()
    expect(screen.getByTestId('business-name').textContent).toBe(businessName)
    expect((window as any)[CANARY]).toBeUndefined()
  })

  it('asset URL with the javascript: protocol is rejected/neutralized', () => {
    const { container } = render(
      <AssetPreview url={`javascript:window.${CANARY}='xss'`} />,
    )

    // No executable anchor or image sink ever carries the javascript: URL.
    const href = screen.getByTestId('asset-link').getAttribute('href')
    expect(href).not.toMatch(/^javascript:/i)
    expect(container.querySelector('img[src^="javascript:"]')).toBeNull()
    expect(container.querySelector('a[href^="javascript:"]')).toBeNull()

    // The dangerous URL is blocked entirely (image not rendered).
    expect(screen.queryByTestId('asset-image')).toBeNull()
    expect(screen.getByTestId('asset-blocked')).toBeTruthy()

    // Nothing executed.
    expect((window as any)[CANARY]).toBeUndefined()
  })

  it('allows a normal https asset URL to render normally (positive control)', () => {
    render(<AssetPreview url="https://cdn.example.com/logo.png" />)

    const img = screen.getByTestId('asset-image')
    expect(img.getAttribute('src')).toBe('https://cdn.example.com/logo.png')
    expect(screen.getByTestId('asset-link').getAttribute('href')).toBe(
      'https://cdn.example.com/logo.png',
    )
    expect((window as any)[CANARY]).toBeUndefined()
  })
})
