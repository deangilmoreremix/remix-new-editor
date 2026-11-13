/**
 * Gets the real bytes of a discovered image as a Blob, for background removal.
 *
 * Deliberately does not `fetch()` a `data:` URL: OpenHiggsBolt's production
 * CSP has no `data:` in connect-src, so that fetch is blocked there. Data URLs
 * are decoded directly instead. Remote website images are tried directly first
 * (works when the host sends CORS headers), then through the same-origin
 * download proxy, whose data-URL answer is decoded the same way.
 */

export function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',')
  if (!dataUrl.startsWith('data:') || comma < 0) throw new Error('Not a data URL')
  const meta = dataUrl.slice(5, comma)
  const type = meta.split(';')[0] || 'application/octet-stream'
  const body = dataUrl.slice(comma + 1)
  if (!/;base64/i.test(meta)) return new Blob([decodeURIComponent(body)], { type })
  const binary = atob(body)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type })
}

export async function loadImageBlob(url: string): Promise<Blob> {
  if (url.startsWith('data:')) return dataUrlToBlob(url)
  try {
    const res = await fetch(url)
    if (res.ok) return await res.blob()
  } catch {
    // A website image usually refuses a cross-origin fetch (or the page's CSP
    // does); read it through the same-origin download route instead.
  }
  try {
    const res = await fetch('/api/personalization/download-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ urls: [url] }),
      signal: AbortSignal.timeout(20_000),
    })
    const data = await res.json().catch(() => ({}))
    const dataUrl = data?.results?.[0]?.ok ? data.results[0].dataUrl : null
    if (res.ok && typeof dataUrl === 'string') return dataUrlToBlob(dataUrl)
  } catch {
    // reported below
  }
  throw new Error('The image could not be loaded.')
}
