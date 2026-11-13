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

/** Longest a direct (cross-origin) download may take, headers and body included. */
export const DIRECT_DOWNLOAD_TIMEOUT_MS = 15_000
/** Longest the same-origin proxy download may take. */
export const PROXY_DOWNLOAD_TIMEOUT_MS = 20_000

function abortError(): Error {
  return Object.assign(new Error('The image download was cancelled.'), { name: 'AbortError' })
}

/** An abort signal that fires on timeout or when the caller's signal aborts; `release()` clears the timer. */
function boundedSignal(parent: AbortSignal | undefined, ms: number): { signal: AbortSignal; release: () => void } {
  const controller = new AbortController()
  const onParentAbort = () => controller.abort()
  const timer = setTimeout(() => controller.abort(), ms)
  if (parent?.aborted) controller.abort()
  else parent?.addEventListener('abort', onParentAbort)
  return {
    signal: controller.signal,
    release: () => {
      clearTimeout(timer)
      parent?.removeEventListener('abort', onParentAbort)
    },
  }
}

/**
 * `signal` cancels the download (Cancel, a removed asset, a new business); the
 * direct attempt and the proxy attempt are each time-boxed, body included, so a
 * stalled host can never hold the caller (the cutout queue) indefinitely.
 */
export async function loadImageBlob(
  url: string,
  options: { signal?: AbortSignal; directTimeoutMs?: number; proxyTimeoutMs?: number } = {},
): Promise<Blob> {
  const { signal } = options
  if (signal?.aborted) throw abortError()
  if (url.startsWith('data:')) return dataUrlToBlob(url)

  const direct = boundedSignal(signal, options.directTimeoutMs ?? DIRECT_DOWNLOAD_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: direct.signal })
    if (res.ok) return await res.blob() // the body read is covered by the same signal
  } catch {
    // A website image usually refuses a cross-origin fetch (or the page's CSP
    // does), or the host stalled: read it through the same-origin download
    // route instead, unless the caller cancelled.
  } finally {
    direct.release()
  }
  if (signal?.aborted) throw abortError()

  const proxy = boundedSignal(signal, options.proxyTimeoutMs ?? PROXY_DOWNLOAD_TIMEOUT_MS)
  try {
    const res = await fetch('/api/personalization/download-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ urls: [url] }),
      signal: proxy.signal,
    })
    const data = await res.json().catch(() => ({}))
    const dataUrl = data?.results?.[0]?.ok ? data.results[0].dataUrl : null
    if (res.ok && typeof dataUrl === 'string') return dataUrlToBlob(dataUrl)
  } catch {
    // reported below
  } finally {
    proxy.release()
  }
  if (signal?.aborted) throw abortError()
  throw new Error('The image could not be loaded.')
}
