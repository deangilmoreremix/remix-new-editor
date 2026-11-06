import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { toHex } from '../../src/lib/colors.js';

const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 15000;
const MAX_REDIRECTS = 5;
const DEFAULT_MAX_PAGES = 6;
const DEFAULT_MAX_IMAGES = 60;
const VALIDATION_CONCURRENCY = 6;
const VALIDATION_BUDGET_MS = 22000;
const VALIDATION_REQUEST_TIMEOUT_MS = 3500;
const DISCOVERY_CACHE_TTL_MS = 5 * 60 * 1000;
const DISCOVERY_CACHE_MAX = 50;
const SITEMAP_MAX_URLS = 30;
const SITEMAP_MAX_FILES = 4;

const DISCOVERY_CACHE = new Map();

const PRIORITY_PATH_HINTS = [
  'about', 'team', 'staff', 'services', 'products', 'gallery', 'portfolio',
  'projects', 'work', 'contact', 'location', 'store', 'shop', 'showroom',
];

const JUNK_HINTS = [
  'favicon', 'sprite', 'pixel', 'tracking', 'analytics', 'beacon', '1x1',
  'spacer', 'loader', 'spinner', 'placeholder', 'blank', 'emoji',
];

const SOCIAL_HOSTS = new Set([
  'facebook.com', 'www.facebook.com', 'instagram.com', 'www.instagram.com',
  'linkedin.com', 'www.linkedin.com', 'x.com', 'www.x.com',
  'twitter.com', 'www.twitter.com', 'tiktok.com', 'www.tiktok.com',
  'youtube.com', 'www.youtube.com', 'pinterest.com', 'www.pinterest.com',
]);

const USEFUL_CATEGORIES = new Set([
  'person', 'logo', 'product', 'service', 'completed_work', 'storefront',
  'office', 'branded_vehicle', 'team', 'brand',
]);

const IMPORT_ROLES = new Set([
  'presenter_identity', 'face_identity', 'character_identity', 'logo',
  'product_reference', 'brand_reference', 'first_frame', 'last_frame',
  'cta_graphic', 'background_reference', 'audio_reference', 'saved_reference',
]);

function isPrivateIpv4(address) {
  const p = address.split('.').map(Number);
  if (p.length !== 4 || p.some((v) => !Number.isInteger(v))) return false;
  return (
    p[0] === 10 ||
    p[0] === 127 ||
    (p[0] === 169 && p[1] === 254) ||
    (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && p[1] === 168) ||
    p[0] === 0
  );
}

function isPrivateIpv6(address) {
  const normalized = String(address || '').toLowerCase();
  return (
    normalized === '::1' ||
    normalized === '::' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:') ||
    normalized.startsWith('::ffff:127.') ||
    normalized.startsWith('::ffff:10.') ||
    normalized.startsWith('::ffff:192.168.')
  );
}

function isPrivateAddress(address) {
  const version = isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version === 6) return isPrivateIpv6(address);
  return false;
}

export async function sanitizePublicHttpUrl(input) {
  if (typeof input !== 'string' || !input.trim()) throw new Error('A website URL is required.');
  let raw = input.trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^https?:/i.test(raw)) {
    throw new Error('Only http/https URLs are allowed.');
  }
  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;

  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only http/https URLs are allowed.');
  const hostname = url.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    throw new Error('Private network addresses are not allowed.');
  }

  if (isPrivateAddress(hostname)) throw new Error('Private network addresses are not allowed.');

  try {
    const records = await lookup(hostname, { all: true, verbatim: true });
    if (!records.length || records.some((record) => isPrivateAddress(record.address))) {
      throw new Error('Private network addresses are not allowed.');
    }
  } catch (error) {
    if (error?.message === 'Private network addresses are not allowed.') throw error;
    throw new Error('Website hostname could not be resolved.');
  }

  url.hash = '';
  return url.toString();
}

async function fetchWithRedirectGuards(inputUrl, options = {}, maxBytes = MAX_HTML_BYTES, timeoutMs = REQUEST_TIMEOUT_MS) {
  let current = await sanitizePublicHttpUrl(inputUrl);
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetch(current, {
        ...options,
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SmartVideoAI-AssetDiscovery/1.0)',
          Accept: options.headers?.Accept || '*/*',
          ...(options.headers || {}),
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Redirect missing Location header.');
      current = await sanitizePublicHttpUrl(new URL(location, current).toString());
      continue;
    }

    const length = Number(response.headers.get('content-length') || 0);
    if (length && length > maxBytes) throw new Error('Remote response exceeds allowed size.');
    return { response, finalUrl: current };
  }
  throw new Error('Too many redirects.');
}

async function fetchHtml(url) {
  try {
    const { response, finalUrl } = await fetchWithRedirectGuards(url, {
      method: 'GET',
      headers: { Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8' },
    }, MAX_HTML_BYTES);
    if (!response.ok) return null;
    const type = String(response.headers.get('content-type') || '').toLowerCase();
    if (!type.includes('text/html') && !type.includes('application/xhtml')) return null;
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > MAX_HTML_BYTES) return null;
    return { html: text, finalUrl };
  } catch {
    return null;
  }
}

async function fetchTextResource(url, maxBytes = 1024 * 1024) {
  try {
    const { response, finalUrl } = await fetchWithRedirectGuards(url, {
      method: 'GET',
      headers: { Accept: 'text/plain,application/xml,text/xml,*/*;q=0.5' },
    }, maxBytes, 7000);
    if (!response.ok) return null;
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > maxBytes) return null;
    return { text, finalUrl };
  } catch {
    return null;
  }
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function getDiscoveryCache(key) {
  const entry = DISCOVERY_CACHE.get(key);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > DISCOVERY_CACHE_TTL_MS) {
    DISCOVERY_CACHE.delete(key);
    return null;
  }
  return clonePlain(entry.value);
}

function setDiscoveryCache(key, value) {
  if (DISCOVERY_CACHE.size >= DISCOVERY_CACHE_MAX) {
    const oldest = DISCOVERY_CACHE.keys().next().value;
    if (oldest) DISCOVERY_CACHE.delete(oldest);
  }
  DISCOVERY_CACHE.set(key, { createdAt: Date.now(), value: clonePlain(value) });
}

function extractXmlLocations(xml) {
  const urls = [];
  for (const match of String(xml || '').matchAll(/<loc\b[^>]*>([\s\S]*?)<\/loc>/gi)) {
    const value = decodeHtml(String(match[1] || '').trim());
    if (value) urls.push(value);
  }
  return Array.from(new Set(urls));
}

async function discoverSitemapLinks(rootUrl, rootHost) {
  const root = new URL(rootUrl);
  const sitemapUrls = new Set([new URL('/sitemap.xml', root).toString()]);

  const robots = await fetchTextResource(new URL('/robots.txt', root).toString(), 512 * 1024);
  if (robots?.text) {
    for (const match of robots.text.matchAll(/^\s*Sitemap:\s*(\S+)\s*$/gim)) {
      const sitemapUrl = absoluteUrl(match[1], rootUrl);
      if (sitemapUrl) sitemapUrls.add(sitemapUrl);
      if (sitemapUrls.size >= SITEMAP_MAX_FILES) break;
    }
  }

  const pageUrls = new Set();
  let sitemapCount = 0;
  for (const sitemapUrl of sitemapUrls) {
    if (sitemapCount >= SITEMAP_MAX_FILES || pageUrls.size >= SITEMAP_MAX_URLS) break;
    sitemapCount += 1;
    const sitemap = await fetchTextResource(sitemapUrl, 1024 * 1024);
    if (!sitemap?.text) continue;

    for (const location of extractXmlLocations(sitemap.text)) {
      if (pageUrls.size >= SITEMAP_MAX_URLS) break;
      let parsed;
      try { parsed = new URL(location, sitemap.finalUrl); } catch { continue; }
      if (parsed.hostname !== rootHost) continue;

      if (/\.xml(?:\?|$)/i.test(parsed.pathname) && sitemapUrls.size < SITEMAP_MAX_FILES) {
        sitemapUrls.add(parsed.toString());
        continue;
      }
      if (/\.(pdf|zip|mp4|mov|avi|webm|jpg|jpeg|png|gif|webp)(?:\?|$)/i.test(parsed.pathname)) continue;
      pageUrls.add(parsed.toString());
    }
  }

  return Array.from(pageUrls);
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function absoluteUrl(raw, base) {
  if (!raw || /^data:/i.test(raw) || /^blob:/i.test(raw)) return '';
  try {
    const url = new URL(decodeHtml(raw.trim()), base);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}

function isLikelyJunk(url) {
  let pathname = '';
  try { pathname = new URL(url).pathname.toLowerCase(); } catch { return true; }
  if (JUNK_HINTS.some((hint) => pathname.includes(hint))) return true;
  if (/\.(ico|svg)(\?|$)/i.test(url)) return true;
  return false;
}

function extractSocialProfiles(html, pageUrl) {
  const out = [];
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)) {
    const href = absoluteUrl(match[1], pageUrl);
    if (!href) continue;
    try {
      const host = new URL(href).hostname.toLowerCase();
      if (SOCIAL_HOSTS.has(host)) out.push({ url: href, platform: host.replace(/^www\./, '').split('.')[0] });
    } catch {}
  }
  return out;
}

function extractInternalLinks(html, pageUrl, rootHost) {
  const links = [];
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>/gi)) {
    const url = absoluteUrl(match[1], pageUrl);
    if (!url) continue;
    try {
      const parsed = new URL(url);
      if (parsed.hostname === rootHost && !/\.(pdf|zip|mp4|mov|avi|webm)$/i.test(parsed.pathname)) {
        links.push(url);
      }
    } catch {}
  }
  return Array.from(new Set(links));
}

function addCandidate(map, rawUrl, baseUrl, meta = {}) {
  const url = absoluteUrl(rawUrl, baseUrl);
  if (!url || isLikelyJunk(url)) return;
  if (!map.has(url)) map.set(url, { url, sourcePage: baseUrl, ...meta });
}

function extractImageCandidates(html, pageUrl) {
  const candidates = new Map();

  for (const match of html.matchAll(/<img\b([^>]*?)>/gi)) {
    const tag = match[1] || '';
    const src = tag.match(/\bsrc=["']([^"']+)["']/i)?.[1];
    const alt = tag.match(/\balt=["']([^"']*)["']/i)?.[1] || '';
    const cls = tag.match(/\bclass=["']([^"']*)["']/i)?.[1] || '';
    if (src) addCandidate(candidates, src, pageUrl, { altText: decodeHtml(alt), context: cls });
    const srcset = tag.match(/\bsrcset=["']([^"']+)["']/i)?.[1];
    if (srcset) {
      for (const entry of srcset.split(',')) {
        addCandidate(candidates, entry.trim().split(/\s+/)[0], pageUrl, { altText: decodeHtml(alt), context: cls });
      }
    }
  }

  for (const match of html.matchAll(/<source\b[^>]*srcset=["']([^"']+)["'][^>]*>/gi)) {
    for (const entry of String(match[1] || '').split(',')) {
      addCandidate(candidates, entry.trim().split(/\s+/)[0], pageUrl, { context: 'picture-source' });
    }
  }

  for (const match of html.matchAll(/<meta\b([^>]*?)>/gi)) {
    const tag = match[1] || '';
    const key = (
      tag.match(/\bproperty=["']([^"']+)["']/i)?.[1] ||
      tag.match(/\bname=["']([^"']+)["']/i)?.[1] ||
      ''
    ).toLowerCase();
    if (!['og:image', 'og:image:url', 'twitter:image', 'twitter:image:src'].includes(key)) continue;
    const value = tag.match(/\bcontent=["']([^"']+)["']/i)?.[1];
    if (value) addCandidate(candidates, value, pageUrl, { context: key });
  }

  // Common JSON-LD image/logo strings. This intentionally avoids evaluating JSON.
  for (const match of html.matchAll(/["'](?:image|logo)["']\s*:\s*["']([^"']+)["']/gi)) {
    addCandidate(candidates, match[1], pageUrl, { context: 'structured-data' });
  }

  return Array.from(candidates.values());
}

function heuristicClassification(candidate) {
  const text = [candidate.url, candidate.altText, candidate.context, candidate.sourcePage]
    .filter(Boolean).join(' ').toLowerCase();

  const rules = [
    { category: 'logo', score: 82, words: ['logo', 'brandmark', 'wordmark'] },
    { category: 'team', score: 72, words: ['team', 'staff', 'crew', 'employees', 'our-people'] },
    { category: 'person', score: 70, words: ['headshot', 'portrait', 'founder', 'owner', 'ceo', 'profile'] },
    { category: 'product', score: 72, words: ['product', 'products', 'shop', 'catalog', 'menu-item'] },
    { category: 'completed_work', score: 70, words: ['portfolio', 'project', 'projects', 'gallery', 'completed', 'before-after', 'case-study'] },
    { category: 'branded_vehicle', score: 72, words: ['truck', 'van', 'vehicle', 'fleet', 'wrap'] },
    { category: 'storefront', score: 68, words: ['storefront', 'location', 'building', 'exterior', 'office-front'] },
    { category: 'office', score: 66, words: ['office', 'interior', 'showroom', 'workspace'] },
    { category: 'service', score: 64, words: ['service', 'services', 'installation', 'repair', 'cleaning', 'roofing', 'plumbing', 'landscaping'] },
    { category: 'brand', score: 60, words: ['hero', 'banner', 'brand', 'about', 'social'] },
  ];

  for (const rule of rules) {
    if (rule.words.some((word) => text.includes(word))) {
      return { category: rule.category, confidence: rule.score, recommended: rule.score >= 65 };
    }
  }

  return { category: 'brand', confidence: 48, recommended: false };
}

async function validateImageCandidate(candidate, timeoutMs = VALIDATION_REQUEST_TIMEOUT_MS) {
  try {
    const safeUrl = await sanitizePublicHttpUrl(candidate.url);
    const perRequestTimeout = Math.max(500, Math.min(VALIDATION_REQUEST_TIMEOUT_MS, Number(timeoutMs) || VALIDATION_REQUEST_TIMEOUT_MS));
    let checked = await fetchWithRedirectGuards(safeUrl, {
      method: 'HEAD',
      headers: { Accept: 'image/*' },
    }, MAX_IMAGE_BYTES, perRequestTimeout);
    if (!checked.response.ok || !String(checked.response.headers.get('content-type') || '').toLowerCase().startsWith('image/')) {
      checked = await fetchWithRedirectGuards(safeUrl, {
        method: 'GET',
        headers: { Accept: 'image/*', Range: 'bytes=0-2047' },
      }, MAX_IMAGE_BYTES, perRequestTimeout);
    }
    const type = String(checked.response.headers.get('content-type') || '').toLowerCase().split(';')[0];
    if (!checked.response.ok || !type.startsWith('image/')) return null;
    const length = Number(checked.response.headers.get('content-length') || 0);
    if (length > MAX_IMAGE_BYTES) return null;
    return { ...candidate, url: checked.finalUrl, mimeType: type };
  } catch {
    return null;
  }
}

async function validateImageCandidatesBounded(candidates, {
  limit,
  budgetMs = VALIDATION_BUDGET_MS,
  concurrency = VALIDATION_CONCURRENCY,
} = {}) {
  const queue = Array.isArray(candidates) ? candidates : [];
  if (!queue.length) return [];

  const maxResults = Math.max(1, Number(limit) || DEFAULT_MAX_IMAGES);
  const deadline = Date.now() + Math.max(1000, Number(budgetMs) || VALIDATION_BUDGET_MS);
  const results = [];
  let cursor = 0;

  async function worker() {
    while (cursor < queue.length && results.length < maxResults) {
      const remaining = deadline - Date.now();
      if (remaining <= 500) return;

      const index = cursor;
      cursor += 1;
      const valid = await validateImageCandidate(
        queue[index],
        Math.min(VALIDATION_REQUEST_TIMEOUT_MS, remaining),
      );
      if (valid && results.length < maxResults) {
        results.push({ index, value: valid });
      }
    }
  }

  const workerCount = Math.max(1, Math.min(Number(concurrency) || VALIDATION_CONCURRENCY, queue.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results
    .sort((a, b) => a.index - b.index)
    .slice(0, maxResults)
    .map((entry) => entry.value);
}

function collectRenderedCandidates(payload, websiteUrl) {
  const candidates = new Map();
  const socialProfiles = new Map();

  const addValue = (value, meta = {}) => {
    if (!value) return;
    if (typeof value === 'string') {
      addCandidate(candidates, value, websiteUrl, meta);
      return;
    }
    if (typeof value === 'object') {
      const url = value.url || value.src || value.currentSrc || value.image || value.href;
      if (url) {
        addCandidate(candidates, url, value.sourcePage || websiteUrl, {
          altText: value.alt || value.altText || '',
          context: value.context || value.className || meta.context || 'rendered-dom',
        });
      }
    }
  };

  for (const value of [
    ...(Array.isArray(payload?.assets) ? payload.assets : []),
    ...(Array.isArray(payload?.images) ? payload.images : []),
    ...(Array.isArray(payload?.data?.assets) ? payload.data.assets : []),
    ...(Array.isArray(payload?.data?.images) ? payload.data.images : []),
  ]) {
    addValue(value, { context: 'rendered-dom' });
  }

  const renderedHtml =
    (typeof payload?.html === 'string' && payload.html) ||
    (typeof payload?.rawHtml === 'string' && payload.rawHtml) ||
    (typeof payload?.data?.html === 'string' && payload.data.html) ||
    (typeof payload?.data?.rawHtml === 'string' && payload.data.rawHtml) ||
    '';
  if (renderedHtml) {
    for (const candidate of extractImageCandidates(renderedHtml, websiteUrl)) {
      if (!candidates.has(candidate.url)) candidates.set(candidate.url, candidate);
    }
    for (const social of extractSocialProfiles(renderedHtml, websiteUrl)) {
      socialProfiles.set(social.url, social);
    }
  }

  for (const social of [
    ...(Array.isArray(payload?.socialProfiles) ? payload.socialProfiles : []),
    ...(Array.isArray(payload?.data?.socialProfiles) ? payload.data.socialProfiles : []),
  ]) {
    if (social?.url) socialProfiles.set(social.url, social);
  }

  const screenshotUrl =
    payload?.screenshot ||
    payload?.url ||
    payload?.image ||
    payload?.data?.screenshot ||
    payload?.data?.url ||
    '';
  if (screenshotUrl) {
    addValue(screenshotUrl, {
      context: 'rendered-screenshot',
      altText: 'Rendered website screenshot',
    });
  }

  return {
    candidates: Array.from(candidates.values()),
    socialProfiles: Array.from(socialProfiles.values()),
  };
}

function discoveredAssetFromValidated(valid, sourceType = 'WEBSITE') {
  const classification = heuristicClassification(valid);
  if (!USEFUL_CATEGORIES.has(classification.category)) return null;
  return {
    id: `disc_${crypto.randomUUID()}`,
    sourceUrl: valid.url,
    previewUrl: valid.url,
    sourcePage: valid.sourcePage,
    sourceType,
    category: classification.category,
    confidence: classification.confidence,
    qualityScore: null,
    relevanceScore: null,
    selected: classification.recommended,
    recommended: classification.recommended,
    rejected: false,
    assignedRole: null,
    autoAssigned: false,
    mimeType: valid.mimeType,
    altText: valid.altText || '',
    visionAnalysis: null,
    editedUrl: null,
    videoReady: false,
  };
}

async function discoverRenderedAssetsFallback(websiteUrl, limit = 20) {
  const apiUrl = process.env.PERSONALIZATION_RENDERED_DISCOVERY_URL || process.env.SCREENSHOT_API_URL;
  if (!apiUrl) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...((process.env.PERSONALIZATION_RENDERED_DISCOVERY_KEY || process.env.SCREENSHOT_API_KEY)
          ? { Authorization: `Bearer ${process.env.PERSONALIZATION_RENDERED_DISCOVERY_KEY || process.env.SCREENSHOT_API_KEY}` }
          : {}),
      },
      // Contract is compatible with an Open-Pomelli/Playwright worker. Older
      // screenshot-only services can ignore the extra fields and still return
      // their screenshot URL.
      body: JSON.stringify({
        url: websiteUrl,
        mode: 'asset-discovery',
        renderer: 'playwright',
        includeImages: true,
        includeHtml: true,
        includeSocial: true,
        width: 1280,
        height: 720,
      }),
      signal: controller.signal,
    });
    if (!response.ok) return null;

    const payload = await response.json().catch(() => ({}));
    const collected = collectRenderedCandidates(payload, websiteUrl);
    const validated = await validateImageCandidatesBounded(collected.candidates, {
      limit: Math.max(1, Math.min(Number(limit) || 20, 30)),
      budgetMs: 12000,
      concurrency: 6,
    });
    const assets = validated
      .map((valid) => discoveredAssetFromValidated(valid, 'PLAYWRIGHT_RENDERED'))
      .filter(Boolean);

    return {
      providerUsed: 'PLAYWRIGHT_RENDERED',
      assets,
      socialProfiles: collected.socialProfiles,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function discoverWithFirecrawlLastFallback(websiteUrl, limit = 20) {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return null;

  const endpoint = process.env.FIRECRAWL_API_URL || 'https://api.firecrawl.dev/v2/scrape';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: websiteUrl,
        formats: ['html', 'images', 'links'],
        onlyMainContent: false,
        maxAge: 0,
      }),
      signal: controller.signal,
    });
    if (!response.ok) return null;

    const payload = await response.json().catch(() => ({}));
    const collected = collectRenderedCandidates(payload, websiteUrl);
    const validated = await validateImageCandidatesBounded(collected.candidates, {
      limit: Math.max(1, Math.min(Number(limit) || 20, 30)),
      budgetMs: 12000,
      concurrency: 6,
    });
    const assets = validated
      .map((valid) => discoveredAssetFromValidated(valid, 'FIRECRAWL'))
      .filter(Boolean);

    return {
      providerUsed: 'FIRECRAWL',
      assets,
      socialProfiles: collected.socialProfiles,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function discoverBusinessAssetsFreeFirst({
  websiteUrl,
  maxPages = DEFAULT_MAX_PAGES,
  maxImages = DEFAULT_MAX_IMAGES,
} = {}) {
  const startedAt = Date.now();
  const rootUrl = await sanitizePublicHttpUrl(websiteUrl);
  const rootHost = new URL(rootUrl).hostname;
  const pageLimit = Math.max(1, Math.min(Number(maxPages) || DEFAULT_MAX_PAGES, 8));
  const imageLimit = Math.max(1, Math.min(Number(maxImages) || DEFAULT_MAX_IMAGES, 60));
  const cacheKey = `${rootUrl}|${pageLimit}|${imageLimit}`;
  const cached = getDiscoveryCache(cacheKey);
  if (cached) {
    return {
      ...cached,
      cached: true,
      durationMs: Date.now() - startedAt,
    };
  }

  const providerAttempts = ['SMARTVIDEO_STATIC'];
  const candidateMap = new Map();
  const socialMap = new Map();
  const pages = [];

  const homepage = await fetchHtml(rootUrl);
  if (homepage) {
    pages.push({ url: homepage.finalUrl, html: homepage.html });
    for (const candidate of extractImageCandidates(homepage.html, homepage.finalUrl)) {
      candidateMap.set(candidate.url, candidate);
    }
    for (const social of extractSocialProfiles(homepage.html, homepage.finalUrl)) {
      socialMap.set(social.url, social);
    }
  }

  // Robots/sitemap is still a free static path and often exposes gallery,
  // product, service and team pages that are not linked from a JS-heavy
  // homepage. It runs before any rendered browser or paid scraper.
  providerAttempts.push('SITEMAP_ROBOTS');
  const sitemapLinks = await discoverSitemapLinks(rootUrl, rootHost);

  const internalLinks = homepage
    ? extractInternalLinks(homepage.html, homepage.finalUrl, rootHost)
    : [];
  const links = Array.from(new Set([...internalLinks, ...sitemapLinks]))
    .map((url) => ({
      url,
      score: PRIORITY_PATH_HINTS.reduce(
        (score, hint) => score + (new URL(url).pathname.toLowerCase().includes(hint) ? hint.length : 0),
        0,
      ),
    }))
    .sort((a, b) => b.score - a.score);

  for (const item of links) {
    if (pages.length >= pageLimit || candidateMap.size >= imageLimit * 2) break;
    if (pages.some((page) => page.url === item.url)) continue;
    const page = await fetchHtml(item.url);
    if (!page) continue;
    pages.push({ url: page.finalUrl, html: page.html });
    for (const candidate of extractImageCandidates(page.html, page.finalUrl)) {
      if (!candidateMap.has(candidate.url)) candidateMap.set(candidate.url, candidate);
    }
    for (const social of extractSocialProfiles(page.html, page.finalUrl)) {
      socialMap.set(social.url, social);
    }
  }

  const discoveredAssets = [];
  const seenAssetUrls = new Set();
  const addAssets = (assets) => {
    for (const asset of Array.isArray(assets) ? assets : []) {
      if (!asset?.sourceUrl || seenAssetUrls.has(asset.sourceUrl)) continue;
      seenAssetUrls.add(asset.sourceUrl);
      discoveredAssets.push(asset);
      if (discoveredAssets.length >= imageLimit) break;
    }
  };

  const validatedCandidates = await validateImageCandidatesBounded(
    Array.from(candidateMap.values()),
    { limit: imageLimit },
  );
  addAssets(validatedCandidates
    .map((valid) => discoveredAssetFromValidated(valid, 'WEBSITE'))
    .filter(Boolean));

  let providerUsed = 'SMARTVIDEO_STATIC';
  let browserUsed = false;
  let firecrawlUsed = false;

  // Free rendered-browser path. The configured endpoint is expected to run
  // Playwright/Open-Pomelli-style DOM extraction and may also return a
  // screenshot. A legacy screenshot-only endpoint remains compatible.
  if (discoveredAssets.length < 3) {
    providerAttempts.push('PLAYWRIGHT_RENDERED');
    const rendered = await discoverRenderedAssetsFallback(
      rootUrl,
      Math.min(imageLimit - discoveredAssets.length, 30),
    );
    if (rendered) {
      const before = discoveredAssets.length;
      addAssets(rendered.assets);
      for (const social of rendered.socialProfiles || []) {
        if (social?.url) socialMap.set(social.url, social);
      }
      if (discoveredAssets.length > before) {
        providerUsed = 'PLAYWRIGHT_RENDERED';
        browserUsed = true;
      }
    }
  }

  // Paid fallback is deliberately last and opt-in by environment key. Static,
  // sitemap and rendered-browser discovery always get the first opportunity.
  if (discoveredAssets.length < 3 && process.env.FIRECRAWL_API_KEY) {
    providerAttempts.push('FIRECRAWL');
    const firecrawl = await discoverWithFirecrawlLastFallback(
      rootUrl,
      Math.min(imageLimit - discoveredAssets.length, 30),
    );
    if (firecrawl) {
      const before = discoveredAssets.length;
      addAssets(firecrawl.assets);
      for (const social of firecrawl.socialProfiles || []) {
        if (social?.url) socialMap.set(social.url, social);
      }
      if (discoveredAssets.length > before) {
        providerUsed = 'FIRECRAWL';
        firecrawlUsed = true;
      }
    }
  }

  const result = {
    providerUsed,
    providerAttempts,
    pagesCrawled: pages.length,
    rawCandidates: candidateMap.size,
    discoveredAssets: discoveredAssets.slice(0, imageLimit),
    socialProfiles: Array.from(socialMap.values()),
    durationMs: Date.now() - startedAt,
    visionUsed: false,
    browserUsed,
    firecrawlUsed,
    cached: false,
  };
  setDiscoveryCache(cacheKey, result);
  return result;
}

function parseDataImage(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=\r\n]+)$/i);
  if (!match) return null;
  const bytes = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new Error('Asset exceeds the allowed size.');
  return { mimeType: match[1].toLowerCase(), bytes };
}

export async function downloadPersonalizationImage(sourceUrl) {
  const inlineImage = parseDataImage(sourceUrl);
  if (inlineImage) {
    return {
      sourceUrl,
      mimeType: inlineImage.mimeType,
      size: inlineImage.bytes.length,
      dataUrl: `data:${inlineImage.mimeType};base64,${inlineImage.bytes.toString('base64')}`,
    };
  }

  const safeUrl = await sanitizePublicHttpUrl(sourceUrl);
  const { response, finalUrl } = await fetchWithRedirectGuards(safeUrl, {
    method: 'GET',
    headers: { Accept: 'image/*' },
  }, MAX_IMAGE_BYTES);
  if (!response.ok) throw new Error(`Image download failed (HTTP ${response.status}).`);

  const mimeType = String(response.headers.get('content-type') || '').toLowerCase().split(';')[0];
  if (!mimeType.startsWith('image/')) throw new Error('URL did not return an image.');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new Error('Image exceeds the allowed size.');

  return {
    sourceUrl: finalUrl,
    mimeType,
    size: bytes.length,
    dataUrl: `data:${mimeType};base64,${bytes.toString('base64')}`,
  };
}

export async function researchBusinessWebsite(websiteUrl) {
  const rootUrl = await sanitizePublicHttpUrl(websiteUrl);
  const page = await fetchHtml(rootUrl);
  if (!page) {
    return {
      canonicalUrl: rootUrl,
      finalUrl: rootUrl,
      reachable: false,
      socialLinks: {},
      contactInfo: { phones: [], emails: [], addresses: [] },
    };
  }

  const html = page.html;
  const finalUrl = page.finalUrl;
  const title = decodeHtml(html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || '').trim();
  const description = decodeHtml(
    html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["'](?:description|og:description)["']/i)?.[1] ||
    ''
  ).trim();
  const logoUrl = absoluteUrl(
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1] ||
    '',
    finalUrl
  ) || '';

  const socialProfiles = extractSocialProfiles(html, finalUrl);
  const socialLinks = {};
  for (const profile of socialProfiles) {
    if (!socialLinks[profile.platform]) socialLinks[profile.platform] = profile.url;
  }

  const phones = new Set();
  const emails = new Set();
  const addresses = new Set();
  for (const match of html.matchAll(/href=["']tel:([^"'?]+)["']/gi)) {
    const phone = decodeHtml(match[1] || '').trim();
    if (phone) phones.add(phone.slice(0, 80));
  }
  for (const match of html.matchAll(/href=["']mailto:([^"'?]+)["']/gi)) {
    const email = decodeHtml(match[1] || '').trim().toLowerCase();
    if (email) emails.add(email.slice(0, 240));
  }
  const textOnly = decodeHtml(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '));
  for (const email of textOnly.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []) {
    emails.add(email.toLowerCase().slice(0, 240));
    if (emails.size >= 10) break;
  }
  for (const match of html.matchAll(/<address\b[^>]*>([\s\S]*?)<\/address>/gi)) {
    const address = decodeHtml(String(match[1] || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (address) addresses.add(address.slice(0, 500));
  }

  return {
    canonicalUrl: rootUrl,
    finalUrl,
    reachable: true,
    title: title.slice(0, 300),
    description: description.slice(0, 1200),
    logoUrl,
    socialLinks,
    contactInfo: {
      phones: Array.from(phones).slice(0, 10),
      emails: Array.from(emails).slice(0, 10),
      addresses: Array.from(addresses).slice(0, 10),
    },
  };
}

function extensionForMime(mime) {
  const type = String(mime || '').toLowerCase();
  if (type.includes('jpeg')) return 'jpg';
  if (type.includes('webp')) return 'webp';
  if (type.includes('gif')) return 'gif';
  return 'png';
}

export async function mirrorPersonalizationAsset({
  supabase,
  userId,
  sourceUrl,
  role,
  name,
} = {}) {
  if (!supabase || !userId) throw new Error('Authenticated storage context is required.');
  if (!IMPORT_ROLES.has(role)) throw new Error('Unsupported personalization asset role.');

  const inlineImage = parseDataImage(sourceUrl);
  let finalUrl = sourceUrl;
  let mimeType;
  let bytes;

  if (inlineImage) {
    mimeType = inlineImage.mimeType;
    bytes = inlineImage.bytes;
  } else {
    const safeUrl = await sanitizePublicHttpUrl(sourceUrl);
    const fetched = await fetchWithRedirectGuards(safeUrl, {
      method: 'GET',
      headers: { Accept: 'image/*' },
    }, MAX_IMAGE_BYTES);
    if (!fetched.response.ok) throw new Error(`Asset download failed (HTTP ${fetched.response.status}).`);
    finalUrl = fetched.finalUrl;
    mimeType = String(fetched.response.headers.get('content-type') || '').toLowerCase().split(';')[0];
    if (!mimeType.startsWith('image/')) throw new Error('Asset URL did not return an image.');
    bytes = new Uint8Array(await fetched.response.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new Error('Asset exceeds the allowed size.');
  }

  const bucket = process.env.ASSETS_BUCKET || 'contact-assets';
  const ext = extensionForMime(mimeType);
  const objectPath = `${userId}/personalization/${role}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(objectPath, bytes, { contentType: mimeType, upsert: false });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  if (!data?.publicUrl) throw new Error('Asset uploaded but no durable URL was returned.');

  return {
    sourceUrl: finalUrl,
    url: data.publicUrl,
    storagePath: objectPath,
    bucket,
    mimeType,
    size: bytes.length,
    role,
    name: String(name || '').trim() || role.replace(/_/g, ' '),
  };
}

// --- Brand Studio scraper -------------------------------------------------
// Powers POST /api/personalizer/brand-scrape. Follows the business asset
// finder's free path: static fetch first, then the rendered Playwright worker
// (PERSONALIZATION_RENDERED_DISCOVERY_URL / SCREENSHOT_API_URL) for the
// screenshot, JS-heavy pages and (when it returns them) the browser-computed
// styles, as in Open-Pomelli's Playwright scraper. It never calls Firecrawl.
// Returns the shape expected by src/lib/brandAnalyzer.js#scrapeSite.

const BRAND_BODY_TEXT_MAX = 8000;
const BRAND_THIN_TEXT_MIN = 200;
const BRAND_MIN_COLORS = 3;
const BRAND_CSS_MAX_FILES = 6;
const BRAND_CSS_MAX_BYTES = 512 * 1024;
const BRAND_CSS_IMPORT_DEPTH = 1;
const BRAND_SCREENSHOT_MAX_CHARS = 8 * 1024 * 1024;
const BRAND_LOGO_MIN_SCORE = 6;
const BRAND_LOGO_MAX = 5;
const BRAND_FONT_MAX = 6;
const BRAND_COLOR_CAP = 3000;

const BRAND_COLOR_TOKEN_RE = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g;
const GENERIC_FONTS = new Set([
  'inherit', 'initial', 'unset', 'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy',
  'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace', '-apple-system', 'blinkmacsystemfont',
  'segoe ui', 'arial', 'helvetica', 'helvetica neue', 'times new roman', 'times',
]);
const ICON_FONT_RE = /(awesome|icon|material|glyph|symbols|dashicons|fontello|ionicons|feather|emoji)/i;
const BRAND_SELECTOR_RE = /(^|[\s,>+~])(body|html|a|button|h[1-3]|header|nav|:root)(?=[\s,.:#[>{+~]|$)|\.(btn|button|primary|cta|brand)\b/i;
const BRAND_VAR_NAME_RE = /(primary|brand|accent|secondary|theme|main)/i;
const NON_BRAND_SECTION_RE = /(client|partner|customer|trusted[\s_-]*by|press|testimonial|sponsor|as[\s_-]*seen|featured[\s_-]*in|logos?[\s_-]*(wall|grid|strip|cloud|carousel|marquee))/i;

function brandToHex(raw) {
  return toHex(raw);
}

function stripCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function stripDarkModeBlocks(css) {
  const re = /@media[^{]*prefers-color-scheme\s*:\s*dark[^{]*\{/gi;
  let out = '';
  let last = 0;
  let m;
  while ((m = re.exec(css))) {
    out += css.slice(last, m.index);
    let depth = 1;
    let j = re.lastIndex;
    while (j < css.length && depth > 0) {
      const ch = css[j++];
      if (ch === '{') depth += 1;
      else if (ch === '}') depth -= 1;
    }
    last = j;
    re.lastIndex = j;
  }
  return out + css.slice(last);
}

function cleanFontName(raw) {
  return String(raw || '').replace(/!important/i, '').replace(/["']/g, '').trim();
}

function addFont(map, raw, weight) {
  const name = cleanFontName(raw);
  if (!name || name.startsWith('var(') || name.length > 60) return;
  const lower = name.toLowerCase();
  if (GENERIC_FONTS.has(lower) || ICON_FONT_RE.test(lower)) return;
  map.set(name, (map.get(name) || 0) + weight);
}

/** Fonts: @font-face and Google Fonts first (the real brand-font signal), then font-family usage. */
function extractBrandFonts(css, html) {
  const fonts = new Map();
  for (const block of css.matchAll(/@font-face\s*\{([^}]*)\}/gi)) {
    const family = block[1].match(/font-family\s*:\s*([^;}]+)/i)?.[1];
    if (family) addFont(fonts, family, 5);
  }
  for (const link of html.matchAll(/fonts\.googleapis\.com\/css2?\?([^"'\s>]+)/gi)) {
    for (const param of decodeHtml(link[1]).split('&')) {
      if (!param.startsWith('family=')) continue;
      const name = decodeURIComponent(param.slice(7).split(':')[0].replace(/\+/g, ' '));
      addFont(fonts, name, 5);
    }
  }
  const usage = css.replace(/@font-face\s*\{[^}]*\}/gi, '');
  for (const match of usage.matchAll(/font-family\s*:\s*([^;}{]+)/gi)) {
    for (const part of match[1].split(',')) addFont(fonts, part, 1);
  }
  return [...fonts.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n).slice(0, BRAND_FONT_MAX);
}

/**
 * Colors from the page's CSS, standing in for upstream's computed styles:
 * custom properties are resolved, dark-mode-only rules are dropped, colors used by
 * body/links/buttons/headings/header/nav and brand-named variables are weighted up,
 * hsl() is supported, and near-greys are dropped. Returns hex strings (repeated by weight).
 */
function extractBrandColors(css, extraColors = []) {
  const clean = stripDarkModeBlocks(stripCssComments(css)).replace(/@font-face\s*\{[^}]*\}/gi, '');

  const vars = new Map();
  for (const m of clean.matchAll(/(--[\w-]+)\s*:\s*([^;}{]+)/g)) {
    if (!vars.has(m[1])) vars.set(m[1], m[2].trim());
  }
  const resolve = (value) => {
    let out = value;
    for (let i = 0; i < 3 && /var\(/.test(out); i += 1) {
      out = out.replace(/var\(\s*(--[\w-]+)\s*(?:,[^)]*)?\)/g, (_, name) => vars.get(name) ?? '');
    }
    return out;
  };

  const counts = [];
  const push = (token, weight) => {
    const hex = brandToHex(token);
    if (!hex) return;
    for (let i = 0; i < weight && counts.length < BRAND_COLOR_CAP; i += 1) counts.push(hex);
  };

  for (const [name, value] of vars) {
    const weight = BRAND_VAR_NAME_RE.test(name) ? 4 : 1;
    for (const token of resolve(value).match(BRAND_COLOR_TOKEN_RE) || []) push(token, weight);
  }

  for (const rule of clean.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
    const selector = rule[1].trim();
    const weight = BRAND_SELECTOR_RE.test(selector) ? 5 : 1;
    for (const decl of rule[2].split(';')) {
      const idx = decl.indexOf(':');
      if (idx < 0) continue;
      const prop = decl.slice(0, idx).trim().toLowerCase();
      if (prop.startsWith('--')) continue; // handled above
      if (!/^(color|background|background-color|border|border-color|fill|stroke|outline-color)$/.test(prop)) continue;
      for (const token of resolve(decl.slice(idx + 1)).match(BRAND_COLOR_TOKEN_RE) || []) push(token, weight);
    }
  }

  for (const token of extraColors) push(token, 5);

  const isGrey = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    return Math.max(r, g, b) - Math.min(r, g, b) < 14;
  };
  const coloured = counts.filter((hex) => !isGrey(hex));
  return coloured.length ? coloured : counts;
}

function visibleBrandText(html) {
  const without = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<(div|section|aside)\b[^>]*(?:id|class)=["'][^"']*(?:cookie|consent|gdpr)[^"']*["'][^>]*>[\s\S]*?<\/\1>/gi, ' ');
  const main = without.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1];
  const scope = main && htmlToPlain(main).length >= BRAND_THIN_TEXT_MIN ? main : without;
  const headings = [...scope.matchAll(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
    .map((m) => htmlToPlain(m[1]))
    .filter(Boolean)
    .slice(0, 12);
  const body = htmlToPlain(scope);
  return [headings.join(' | '), body].filter(Boolean).join('\n').slice(0, BRAND_BODY_TEXT_MAX);
}

function htmlToPlain(html) {
  return decodeHtml(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function brandNameToken(pageUrl) {
  try {
    const parts = new URL(pageUrl).hostname.toLowerCase().replace(/^www\./, '').split('.');
    const token = parts.length > 1 ? parts[parts.length - 2] : parts[0];
    return token && token.length >= 3 ? token : '';
  } catch {
    return '';
  }
}

/** Logos, ranked: JSON-LD, then images by header / home-link / brand-name / "logo" signals; customer-logo walls are penalised. */
function extractBrandLogos(html, pageUrl) {
  const scored = new Map();
  const bump = (url, score) => {
    if (!url) return;
    scored.set(url, Math.max(scored.get(url) ?? -Infinity, score));
  };

  for (const m of html.matchAll(/["']logo["']\s*:\s*["']([^"']+)["']/gi)) {
    bump(absoluteUrl(m[1], pageUrl), 20);
  }

  const zones = [...html.matchAll(/<(header|nav)\b[^>]*>[\s\S]*?<\/\1>/gi)].map((m) => [m.index, m.index + m[0].length]);
  const token = brandNameToken(pageUrl);
  let origin = '';
  try { origin = new URL(pageUrl).origin; } catch {}

  for (const m of html.matchAll(/<img\b([^>]*?)>/gi)) {
    const tag = m[1] || '';
    const src = tag.match(/\b(?:data-src|src)=["']([^"']+)["']/i)?.[1];
    const url = absoluteUrl(src || '', pageUrl);
    if (!url) continue;
    const rawAlt = decodeHtml(tag.match(/\balt=["']([^"']*)["']/i)?.[1] || '');
    // A descriptive sentence ("Aerial view ... imitating the Stripe logo.") is not a logo label.
    const alt = rawAlt.split(/\s+/).filter(Boolean).length <= 5 ? rawAlt : '';
    const cls = tag.match(/\bclass=["']([^"']*)["']/i)?.[1] || '';
    const hay = `${url} ${alt} ${cls}`.toLowerCase();

    // Match the brand name against the file path / alt / class only: CDN hosts such as
    // images.stripeassets.com or www.notion.com would otherwise match every image.
    let pathname = '';
    try { pathname = new URL(url).pathname; } catch {}
    const nameHay = `${pathname} ${alt} ${cls}`.toLowerCase();

    let score = 0;
    if (/logo|brandmark|wordmark/.test(hay)) score += 4;
    if (zones.some(([a, b]) => m.index >= a && m.index <= b)) score += 3;
    if (token && nameHay.includes(token)) score += 3;

    // "Hertz logo" on a stripe.com page is somebody else's logo.
    const named = alt.match(/^\s*(.+?)\s+logo\s*$/i);
    if (named && token && !named[1].toLowerCase().includes(token)) score -= 8;

    const before = html.slice(Math.max(0, m.index - 400), m.index);
    const openA = before.lastIndexOf('<a ');
    if (openA > before.lastIndexOf('</a>')) {
      const href = before.slice(openA).match(/href=["']([^"']*)["']/i)?.[1];
      if (href !== undefined) {
        const abs = absoluteUrl(href, pageUrl);
        if (href === '' || href === '/' || href === '#' || href === './' || (abs && abs.replace(/\/$/, '') === origin)) score += 3;
      }
    }

    const context = html.slice(Math.max(0, m.index - 700), m.index);
    if (NON_BRAND_SECTION_RE.test(context.slice(-700)) || NON_BRAND_SECTION_RE.test(cls)) score -= 8;

    if (score >= BRAND_LOGO_MIN_SCORE) bump(url, score);
  }

  const ranked = [...scored.entries()].sort((a, b) => b[1] - a[1]).map(([u]) => u).slice(0, BRAND_LOGO_MAX);

  // Brand icons are a better fallback than a generic og:image (at most two sizes).
  let icons = 0;
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/rel=["'][^"']*(apple-touch-icon|mask-icon)[^"']*["']/i.test(tag)) continue;
    const url = absoluteUrl(tag.match(/href=["']([^"']+)["']/i)?.[1] || '', pageUrl);
    if (url && !ranked.includes(url) && ranked.length < BRAND_LOGO_MAX && icons < 2) {
      ranked.push(url);
      icons += 1;
    }
  }
  return ranked;
}

async function fetchBrandStylesheets(html, pageUrl) {
  const found = [];
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    if (!/rel=["']stylesheet["']/i.test(m[0])) continue;
    const abs = absoluteUrl(m[0].match(/href=["']([^"']+)["']/i)?.[1] || '', pageUrl);
    if (abs) found.push(abs);
  }
  const seen = new Set();
  const texts = [];
  let queue = found;
  for (let depth = 0; depth <= BRAND_CSS_IMPORT_DEPTH && queue.length; depth += 1) {
    const batch = queue.filter((u) => !seen.has(u)).slice(0, Math.max(0, BRAND_CSS_MAX_FILES - seen.size));
    batch.forEach((u) => seen.add(u));
    const loaded = await Promise.all(batch.map((u) => fetchTextResource(u, BRAND_CSS_MAX_BYTES)));
    const next = [];
    loaded.forEach((res, i) => {
      if (!res?.text) return;
      texts.push(res.text);
      for (const im of res.text.matchAll(/@import\s+(?:url\()?\s*["']?([^"')\s;]+)/gi)) {
        const abs = absoluteUrl(im[1], batch[i]);
        if (abs) next.push(abs);
      }
    });
    queue = next;
  }
  return texts;
}

async function extractBrandFromHtml(html, pageUrl) {
  const metaContent = (names) => {
    for (const name of names) {
      const re1 = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']*)["']`, 'i');
      const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${name}["']`, 'i');
      const hit = html.match(re1)?.[1] ?? html.match(re2)?.[1];
      if (hit) return decodeHtml(hit).trim();
    }
    return '';
  };

  const title = decodeHtml(html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || metaContent(['og:title'])).trim();
  const description = metaContent(['description', 'og:description']);
  const ogImage = absoluteUrl(metaContent(['og:image', 'og:image:url', 'twitter:image']), pageUrl) || null;
  const iconMatch = html.match(/<link[^>]+rel=["'][^"']*\bicon\b[^"']*["'][^>]*href=["']([^"']+)["']/i)
    || html.match(/<link[^>]+href=["']([^"']+)["'][^>]*rel=["'][^"']*\bicon\b[^"']*["']/i);
  const favicon = absoluteUrl(iconMatch?.[1] || '/favicon.ico', pageUrl) || null;

  const cssParts = [];
  for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) cssParts.push(m[1]);
  for (const m of html.matchAll(/\sstyle=["']([^"']+)["']/gi)) cssParts.push(`x{${m[1]}}`);
  cssParts.push(...await fetchBrandStylesheets(html, pageUrl));
  const css = cssParts.join('\n');

  const themeColor = metaContent(['theme-color']);
  return {
    title: title.slice(0, 300),
    description: description.slice(0, 1200),
    ogImage,
    favicon,
    logoCandidates: extractBrandLogos(html, pageUrl),
    fonts: extractBrandFonts(css, html),
    rawColors: extractBrandColors(css, themeColor ? [themeColor] : []),
    bodyText: visibleBrandText(html),
  };
}

// Same endpoint, auth and request contract as discoverRenderedAssetsFallback, plus a
// hint asking the worker for upstream's page.evaluate output. Returns
// { html, screenshot, computed } (each may be empty) or null when the worker is
// not configured or fails. `screenshot` is a data URI.
async function fetchRenderedBrandSnapshot(websiteUrl) {
  const apiUrl = process.env.PERSONALIZATION_RENDERED_DISCOVERY_URL || process.env.SCREENSHOT_API_URL;
  if (!apiUrl) return null;
  const key = process.env.PERSONALIZATION_RENDERED_DISCOVERY_KEY || process.env.SCREENSHOT_API_KEY;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
      },
      body: JSON.stringify({
        url: websiteUrl,
        mode: 'asset-discovery',
        renderer: 'playwright',
        includeImages: true,
        includeHtml: true,
        includeSocial: false,
        includeComputedStyles: true,
        width: 1440,
        height: 900,
      }),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const payload = await response.json().catch(() => ({}));
    const root = payload?.data && typeof payload.data === 'object' ? { ...payload.data, ...payload } : payload;

    const html =
      (typeof root?.html === 'string' && root.html) ||
      (typeof root?.rawHtml === 'string' && root.rawHtml) ||
      '';

    const strings = (v, max) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x).slice(0, max) : []);
    const computed = {
      colors: strings(root?.computedStyles?.colors ?? root?.rawColors, 200),
      fonts: strings(root?.computedStyles?.fonts ?? root?.fonts, 20),
      logoCandidates: strings(root?.logoCandidates, 10),
      bodyText: typeof root?.bodyText === 'string' ? root.bodyText.slice(0, BRAND_BODY_TEXT_MAX) : '',
    };

    const shot = root?.screenshot || root?.image || root?.url || '';
    let screenshot = null;
    if (typeof shot === 'string' && shot) {
      if (shot.startsWith('data:image/')) {
        screenshot = shot.length <= BRAND_SCREENSHOT_MAX_CHARS ? shot : null;
      } else if (/^https?:\/\//i.test(shot)) {
        try {
          const { response: img } = await fetchWithRedirectGuards(shot, { method: 'GET' }, MAX_IMAGE_BYTES);
          const type = String(img.headers.get('content-type') || '').toLowerCase();
          if (img.ok && type.startsWith('image/')) {
            const buf = Buffer.from(await img.arrayBuffer());
            if (buf.length && buf.length <= MAX_IMAGE_BYTES) {
              screenshot = `data:${type.split(';')[0]};base64,${buf.toString('base64')}`;
            }
          }
        } catch {
          screenshot = null;
        }
      }
    }
    return { html, screenshot, computed };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function scrapeBrandSite(websiteUrl) {
  const rootUrl = await sanitizePublicHttpUrl(websiteUrl);

  // 1) Free static fetch (same helper as the asset finder).
  const staticPage = await fetchHtml(rootUrl);
  const finalUrl = staticPage?.finalUrl || rootUrl;
  let brand = staticPage ? await extractBrandFromHtml(staticPage.html, finalUrl) : null;

  // 2) Rendered Playwright worker: screenshot always; DOM when the static page is a thin
  //    shell (JS-heavy SPA) or yields too few colors; computed styles when it returns them.
  const rendered = await fetchRenderedBrandSnapshot(finalUrl);
  const thin = !brand || brand.bodyText.length < BRAND_THIN_TEXT_MIN || brand.rawColors.length < BRAND_MIN_COLORS;
  if (rendered?.html && thin) {
    const fromRendered = await extractBrandFromHtml(rendered.html, finalUrl);
    brand = brand
      ? {
          ...brand,
          title: brand.title || fromRendered.title,
          description: brand.description || fromRendered.description,
          ogImage: brand.ogImage || fromRendered.ogImage,
          bodyText: fromRendered.bodyText.length > brand.bodyText.length ? fromRendered.bodyText : brand.bodyText,
          logoCandidates: brand.logoCandidates.length ? brand.logoCandidates : fromRendered.logoCandidates,
          fonts: brand.fonts.length ? brand.fonts : fromRendered.fonts,
          rawColors: fromRendered.rawColors.length > brand.rawColors.length ? fromRendered.rawColors : brand.rawColors,
        }
      : fromRendered;
  }
  if (!brand) throw new Error('Website could not be fetched.');

  // Browser-computed values, when the worker provides them, beat CSS parsing.
  const c = rendered?.computed;
  if (c?.colors?.length) brand.rawColors = c.colors;
  if (c?.fonts?.length) {
    const fonts = new Map();
    c.fonts.forEach((f) => addFont(fonts, f, 1));
    if (fonts.size) brand.fonts = [...fonts.keys()].slice(0, BRAND_FONT_MAX);
  }
  if (c?.logoCandidates?.length) {
    const abs = c.logoCandidates.map((u) => absoluteUrl(u, finalUrl)).filter(Boolean);
    brand.logoCandidates = [...new Set([...abs, ...brand.logoCandidates])].slice(0, BRAND_LOGO_MAX);
  }
  if (c?.bodyText && c.bodyText.length > brand.bodyText.length) brand.bodyText = c.bodyText;

  return {
    url: finalUrl,
    title: brand.title,
    description: brand.description,
    bodyText: brand.bodyText,
    ogImage: brand.ogImage,
    favicon: brand.favicon,
    logoCandidates: brand.logoCandidates,
    fonts: brand.fonts,
    rawColors: brand.rawColors,
    screenshot: rendered?.screenshot || null,
  };
}
