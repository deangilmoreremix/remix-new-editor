/**
 * Sitemap parsing: <sitemapindex> recursion, <urlset>, gzip, hard caps. Technique reimplemented
 * from Scrapling's SitemapSpider. Fetching is injected (the caller supplies the SSRF-safe fetch).
 */
import { gunzipSync } from 'node:zlib'

export interface ParsedSitemap { kind: 'index' | 'urlset' | 'unknown'; locs: string[] }

export function maybeGunzip(buf: Buffer): string {
  const isGz = buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b
  return (isGz ? gunzipSync(buf, { maxOutputLength: 5_000_000 }) : buf).toString('utf8')
}

export function parseSitemapXml(xml: string): ParsedSitemap {
  const locs = [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s][^<\]]*?)\s*(?:\]\]>)?\s*<\/loc>/gi)].map((m) => m[1].replace(/&amp;/g, '&'))
  if (/<sitemapindex[\s>]/i.test(xml)) return { kind: 'index', locs }
  if (/<urlset[\s>]/i.test(xml)) return { kind: 'urlset', locs }
  return { kind: 'unknown', locs: [] }
}

export interface CrawlSitemapOptions {
  fetchBytes: (url: string) => Promise<Buffer | null>
  maxSitemaps?: number
  maxUrls?: number
  maxDepth?: number
  sameSite?: (url: string) => boolean
}

export async function crawlSitemaps(roots: string[], o: CrawlSitemapOptions): Promise<{ urls: string[]; sitemapsFetched: number }> {
  const maxSitemaps = o.maxSitemaps ?? 5, maxUrls = o.maxUrls ?? 200, maxDepth = o.maxDepth ?? 2
  const seen = new Set<string>(), urls = new Set<string>()
  let fetched = 0
  const queue: Array<{ url: string; depth: number }> = roots.map((url) => ({ url, depth: 0 }))
  while (queue.length && fetched < maxSitemaps && urls.size < maxUrls) {
    const { url, depth } = queue.shift()!
    if (seen.has(url)) continue
    seen.add(url)
    if (o.sameSite && !o.sameSite(url)) continue
    let buf: Buffer | null = null
    try { buf = await o.fetchBytes(url) } catch { buf = null }
    if (!buf) continue
    fetched++
    let parsed: ParsedSitemap
    try { parsed = parseSitemapXml(maybeGunzip(buf)) } catch { continue }
    if (parsed.kind === 'index') {
      if (depth < maxDepth) for (const l of parsed.locs) queue.push({ url: l, depth: depth + 1 })
    } else if (parsed.kind === 'urlset') {
      for (const l of parsed.locs) { if (urls.size >= maxUrls) break; if (!o.sameSite || o.sameSite(l)) urls.add(l) }
    }
  }
  return { urls: [...urls], sitemapsFetched: fetched }
}
