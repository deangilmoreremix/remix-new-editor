// packages/assets/src/extractors/logo.ts
//
// Detect a logo image URL from a website's HTML. We try, in order of
// reliability:
//   1. <meta property="og:image">            — the OpenGraph share image
//   2. <link rel="apple-touch-icon">          — high-res icon
//   3. <link rel="icon" sizes="...">          — favicon, prefer largest size
//   4. <img> inside <header> with "logo" class/name/alt
//   5. <img class="logo"> anywhere on the page
//   6. <img alt="logo"> or alt="Logo" anywhere
//   7. <link rel="preload" as="image"> with "logo" in the path
//
// If the page exposes a JSON-LD `ImageObject` we also pick that up.

import type { DiscoveredAsset } from '../types.ts';

export interface LogoDetectionResult {
  url?: string;
  candidates: Array<{ url: string; source: string; score: number }>;
}

export function detectLogoFromHtml(html: string, baseUrl: string): LogoDetectionResult {
  const candidates: LogoDetectionResult['candidates'] = [];
  const resolve = (raw: string) => resolveUrl(baseUrl, raw);

  // 1. og:image
  const ogImage = matchAttr(html, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i, 'content');
  if (ogImage) candidates.push({ url: resolve(ogImage), source: 'og:image', score: 70 });

  // 2. twitter:image
  const twImage = matchAttr(html, /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i, 'content');
  if (twImage) candidates.push({ url: resolve(twImage), source: 'twitter:image', score: 65 });

  // 3. apple-touch-icon (prefers 180x180+)
  const appleMatch = matchAllAttrs(html, /<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/gi, 'href');
  for (const url of appleMatch) candidates.push({ url: resolve(url), source: 'apple-touch-icon', score: 80 });

  // 4. <link rel="icon" sizes="...">
  const iconMatches = html.matchAll(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]*?>/gi);
  for (const m of iconMatches) {
    const tag = m[0];
    const hrefMatch = tag.match(/href=["']([^"']+)["']/i);
    const sizesMatch = tag.match(/sizes=["'](\d+)x(\d+)["']/i);
    if (!hrefMatch) continue;
    const size = sizesMatch ? parseInt(sizesMatch[1], 10) * parseInt(sizesMatch[2], 10) : 16;
    candidates.push({
      url: resolve(hrefMatch[1]),
      source: 'favicon',
      score: 30 + Math.min(60, Math.round(size / 100)),
    });
  }

  // 5. <img> inside <header> with logo in class/alt
  const headerRe = /<header[^>]*>([\s\S]*?)<\/header>/i;
  const headerMatch = html.match(headerRe);
  if (headerMatch) {
    const imgs = headerMatch[1].matchAll(/<img[^>]+(?:class|alt)=["'][^"']*logo[^"']*["'][^>]*>/gi);
    for (const im of imgs) {
      const src = im[0].match(/src=["']([^"']+)["']/i);
      if (src) candidates.push({ url: resolve(src[1]), source: 'header img', score: 90 });
    }
  }

  // 6. <img class="logo"> or alt="logo"
  const logoImgs = html.matchAll(/<img[^>]+(?:class|alt)=["'][^"']*logo[^"']*["'][^>]+src=["']([^"']+)["']/gi);
  for (const im of logoImgs) {
    candidates.push({ url: resolve(im[1]), source: 'img.logo', score: 85 });
  }

  // 7. <link rel="preload" as="image"> with logo in href
  const preloadImgs = html.matchAll(/<link[^>]+rel=["']preload["'][^>]+as=["']image["'][^>]+href=["']([^"']*logo[^"']*)["']/gi);
  for (const p of preloadImgs) {
    candidates.push({ url: resolve(p[1]), source: 'preload logo', score: 80 });
  }

  // 8. JSON-LD ImageObject
  const jsonLdMatches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const j of jsonLdMatches) {
    try {
      const data = JSON.parse(j[1]);
      const image = findJsonLdImage(data);
      if (image) candidates.push({ url: resolve(image), source: 'json-ld', score: 75 });
    } catch {
      // ignore parse errors
    }
  }

  // Dedupe by URL
  const seen = new Set<string>();
  const unique = candidates.filter((c) => {
    if (seen.has(c.url)) return false;
    seen.add(c.url);
    return true;
  });

  // Sort by score desc
  unique.sort((a, b) => b.score - a.score);

  return { url: unique[0]?.url, candidates: unique };
}

export function buildLogoAsset(url: string, baseUrl: string): DiscoveredAsset {
  return {
    assetType: 'logo',
    url,
    metadata: {
      hostname: safeHostname(url),
    },
    source: {
      source: 'website',
      sourceUrl: url,
      discoveredAt: new Date().toISOString(),
    },
  };
}

function matchAttr(html: string, re: RegExp, group: number = 1): string | undefined {
  const m = html.match(re);
  return m ? m[group] : undefined;
}

function matchAllAttrs(html: string, re: RegExp, _group: number = 1): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(re)) {
    if (m[1]) out.push(m[1]);
  }
  return out;
}

function resolveUrl(base: string, relative: string): string {
  try {
    return new URL(relative, base).toString();
  } catch {
    return relative;
  }
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function findJsonLdImage(node: any): string | undefined {
  if (!node || typeof node !== 'object') return undefined;
  if (typeof node.url === 'string' && node['@type'] === 'ImageObject') return node.url;
  if (typeof node.image === 'string') return node.image;
  if (Array.isArray(node.image)) {
    const first = node.image.find((x: any) => typeof x === 'string');
    if (first) return first;
  }
  if (node.logo) {
    const logo = node.logo;
    if (typeof logo === 'string') return logo;
    if (typeof logo === 'object' && typeof logo.url === 'string') return logo.url;
  }
  if (Array.isArray(node['@graph'])) {
    for (const child of node['@graph']) {
      const found = findJsonLdImage(child);
      if (found) return found;
    }
  }
  return undefined;
}
