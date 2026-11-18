/**
 * Brand Studio: free, no-browser fallback for /api/scrape.
 *
 * Some sites block headless Chromium (bot walls, "Access denied", captcha pages) yet still answer a plain HTTP
 * request with their real HTML. This reads that HTML with Cheerio, the same way the asset-discovery crawler does,
 * through `fetchPage`, which validates the destination and every redirect hop (SSRF guard) before connecting.
 * It also recognises block pages, so a "Robot Check" title is never mistaken for the brand's name.
 */
import * as cheerio from 'cheerio'
import { fetchPage } from './discoverAssets'
import type { BrandScrapeResult } from './browserDiscovery'

const MAX_IMAGES = 30
const MAX_VIDEOS = 10
const BLOCK_TITLE =
  /(robot|captcha|are you a human|verify you are|access denied|just a moment|attention required|unusual traffic|security check|blocked|forbidden|service unavailable|sorry!)/i
/** Beacons, pixels and analytics calls are requests, not site imagery. */
const TRACKING = /(\/batch\/|beacon|pixel[._/-]|\/pixel|tracking|analytics|\/collect\b|\/log\b|doubleclick|googletagmanager|google-analytics|facebook\.com\/tr|\/1x1\b|spacer\.gif|\/ping\b|\/impression)/i
const VIDEO_URL = /\.(mp4|webm|m3u8|mov|m4v)(?:[?#]|$)/i
const IMAGE_URL = /\.(png|jpe?g|webp|avif|gif|svg)(?:[?#]|$)/i

/** True when the scrape shows a block / challenge page or nothing usable, not the site's real content. */
export function looksBlocked(r: Pick<BrandScrapeResult, 'title' | 'bodyText'> | null | undefined): boolean {
  if (!r) return true
  const title = (r.title || '').trim()
  const body = (r.bodyText || '').trim()
  if (!title && body.length < 120) return true
  if (title && BLOCK_TITLE.test(title) && body.length < 600) return true
  if (!title && !body) return true
  return false
}

const absolute = (value: string | undefined, base: string): string | null => {
  if (!value) return null
  // A bare base64 blob used as a lazy-load placeholder is not an address.
  if (/^[A-Za-z0-9+/=]{40,}$/.test(value.trim())) return null
  try {
    const u = new URL(value.trim(), base)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null
  } catch {
    return null
  }
}

/** The widest candidate of a `srcset`, falling back to nothing when it has none. */
function bestFromSrcset(srcset: string | undefined, base: string): string | null {
  if (!srcset) return null
  let best: { url: string; w: number } | null = null
  for (const part of srcset.split(',')) {
    const [u, d] = part.trim().split(/\s+/)
    const w = d ? parseFloat(d) || 1 : 1
    const url = absolute(u, base)
    if (url && (!best || w >= best.w)) best = { url, w }
  }
  return best?.url ?? null
}

/** A page with a real title but next to no text (client-rendered shell, interstitial, partial load). */
export function isThin(r: Pick<BrandScrapeResult, 'bodyText'> | null | undefined): boolean {
  return !r || (r.bodyText || '').trim().length < 500
}

const union = <T,>(a: T[] | undefined, b: T[] | undefined, max: number): T[] => Array.from(new Set([...(a || []), ...(b || [])])).slice(0, max)

/**
 * Picks the better of a browser scrape and a static one. The static page supplies the text when it is richer; the
 * browser supplies what only it can: the screenshot and computed colours/fonts. Media from both is merged.
 */
export function mergeScrapes(browser: BrandScrapeResult, fallback: BrandScrapeResult): BrandScrapeResult {
  return {
    ...fallback,
    screenshot: browser.screenshot,
    logoCandidates: union(browser.logoCandidates, fallback.logoCandidates, 5),
    fonts: union(browser.fonts, fallback.fonts, 20),
    rawColors: browser.rawColors.length ? browser.rawColors : fallback.rawColors,
    images: union(browser.images, fallback.images, MAX_IMAGES),
    videos: union(browser.videos, fallback.videos, MAX_VIDEOS),
  }
}

/** Pure: reads a page's HTML into the same shape the Chromium scraper returns (no screenshot). */
export function parseBrandHtml(html: string, pageUrl: string): BrandScrapeResult {
  const $ = cheerio.load(html)
  const meta = (sel: string) => ($(sel).first().attr('content') || '').trim()

  const images = new Set<string>()
  const videos = new Set<string>()
  const addImage = (u: string | null) => {
    if (u && !TRACKING.test(u) && images.size < MAX_IMAGES) images.add(u)
  }
  const addVideo = (u: string | null) => {
    if (u && videos.size < MAX_VIDEOS) videos.add(u)
  }

  const ogImage = absolute(meta('meta[property="og:image"]') || meta('meta[name="twitter:image"]'), pageUrl)
  if (ogImage) addImage(ogImage)

  const logos: string[] = []
  $('img').each((_i, el) => {
    const src = absolute($(el).attr('data-src') || $(el).attr('src'), pageUrl)
    const best = bestFromSrcset($(el).attr('srcset') || $(el).attr('data-srcset'), pageUrl) || src
    const alt = $(el).attr('alt') || ''
    if (src && (/logo/i.test(src) || /logo/i.test(alt))) logos.push(src)
    addImage(best)
  })
  $('picture source[srcset]').each((_i, el) => addImage(bestFromSrcset($(el).attr('srcset'), pageUrl)))
  $('link[rel~="preload"][as="image"]').each((_i, el) => addImage(absolute($(el).attr('href'), pageUrl)))

  $('video').each((_i, el) => {
    addVideo(absolute($(el).attr('src'), pageUrl))
    addImage(absolute($(el).attr('poster'), pageUrl))
    $(el)
      .find('source')
      .each((_j, s) => addVideo(absolute($(s).attr('src'), pageUrl)))
  })
  for (const sel of ['meta[property="og:video"]', 'meta[property="og:video:url"]', 'meta[property="og:video:secure_url"]', 'meta[name="twitter:player:stream"]']) {
    addVideo(absolute(meta(sel), pageUrl))
  }

  // Colours and fonts: only what the HTML itself declares (inline <style> and style="" attributes).
  const css = [$('style').text(), ...$('[style]').map((_i, el) => $(el).attr('style') || '').get()].join('\n')
  const colors = (css.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []).slice(0, 80)
  const fonts = new Set<string>()
  for (const m of css.matchAll(/font-family\s*:\s*([^;}{]+)/gi)) {
    m[1].split(',').forEach((f) => {
      const name = f.trim().replace(/^['"]|['"]$/g, '')
      if (name && !/^(inherit|initial|unset|var\()/i.test(name)) fonts.add(name)
    })
  }
  $('link[href*="fonts.googleapis.com"]').each((_i, el) => {
    // css?family=Poppins:400|Open+Sans, and css2?family=Inter:wght@400&family=Lora (one `family=` per font)
    const href = absolute($(el).attr('href'), pageUrl) || ''
    for (const m of href.matchAll(/family=([^&]+)/g)) {
      m[1].split('|').forEach((f) => {
        const name = decodeURIComponent(f.split(':')[0]).replace(/\+/g, ' ').trim()
        if (name) fonts.add(name)
      })
    }
  })

  $('script, style, noscript, svg, template, iframe').remove()
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 8000)

  const faviconHref = $('link[rel~="icon"]').first().attr('href')
  // Anything the page serves as a media file is also a candidate, even when it sits in a plain link.
  $('a[href]').each((_i, el) => {
    const u = absolute($(el).attr('href'), pageUrl)
    if (u && VIDEO_URL.test(u)) addVideo(u)
    else if (u && IMAGE_URL.test(u)) addImage(u)
  })

  return {
    url: pageUrl,
    title: ($('title').first().text() || meta('meta[property="og:title"]')).trim(),
    description: meta('meta[name="description"]') || meta('meta[property="og:description"]'),
    bodyText,
    ogImage,
    favicon: absolute(faviconHref || '/favicon.ico', pageUrl),
    logoCandidates: Array.from(new Set(logos)).slice(0, 5),
    fonts: Array.from(fonts).slice(0, 20),
    rawColors: colors,
    screenshot: null,
    images: Array.from(images),
    videos: Array.from(videos),
  }
}

/** Fetches the page without a browser (SSRF-validated) and reads it; null when the site refuses or has no HTML. */
export async function scrapeBrandStatic(rawUrl: string, deadlineAt?: number): Promise<BrandScrapeResult | null> {
  const html = await fetchPage(rawUrl, deadlineAt)
  if (!html) return null
  return parseBrandHtml(html, rawUrl)
}
