import { describe, it, expect } from 'vitest'
import { fetchStylesheet } from '../discoverAssets'

// The real function, not a mock: it must refuse private destinations before any connection is made.
describe('fetchStylesheet', () => {
  it('refuses loopback, private and metadata addresses', async () => {
    for (const url of ['http://127.0.0.1/a.css', 'http://localhost/a.css', 'http://169.254.169.254/a.css', 'http://10.0.0.5/a.css', 'http://[::1]/a.css']) {
      expect(await fetchStylesheet(url, Date.now() + 5000), url).toBeNull()
    }
  })
  it('does nothing once the deadline has passed', async () => {
    expect(await fetchStylesheet('https://example.com/a.css', Date.now() - 1)).toBeNull()
  })
})
