import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

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

  const homepage = await fetchHtml(rootUrl);
  if (!homepage) {
    return {
      providerUsed: 'SMARTVIDEO_STATIC',
      providerAttempts: ['SMARTVIDEO_STATIC'],
      pagesCrawled: 0,
      rawCandidates: 0,
      discoveredAssets: [],
      socialProfiles: [],
      durationMs: Date.now() - startedAt,
    };
  }

  const candidateMap = new Map();
  const socialMap = new Map();
  const pages = [{ url: homepage.finalUrl, html: homepage.html }];
  for (const candidate of extractImageCandidates(homepage.html, homepage.finalUrl)) {
    candidateMap.set(candidate.url, candidate);
  }
  for (const social of extractSocialProfiles(homepage.html, homepage.finalUrl)) socialMap.set(social.url, social);

  const links = extractInternalLinks(homepage.html, homepage.finalUrl, rootHost)
    .map((url) => ({
      url,
      score: PRIORITY_PATH_HINTS.reduce((score, hint) => score + (new URL(url).pathname.toLowerCase().includes(hint) ? hint.length : 0), 0),
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
    for (const social of extractSocialProfiles(page.html, page.finalUrl)) socialMap.set(social.url, social);
  }

  const discoveredAssets = [];
  const validatedCandidates = await validateImageCandidatesBounded(
    Array.from(candidateMap.values()),
    { limit: imageLimit },
  );
  for (const valid of validatedCandidates) {
    const classification = heuristicClassification(valid);
    if (!USEFUL_CATEGORIES.has(classification.category)) continue;
    discoveredAssets.push({
      id: `disc_${crypto.randomUUID()}`,
      sourceUrl: valid.url,
      previewUrl: valid.url,
      sourcePage: valid.sourcePage,
      sourceType: 'WEBSITE',
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
    });
    if (discoveredAssets.length >= imageLimit) break;
  }

  const providerAttempts = ['SMARTVIDEO_STATIC'];
  let providerUsed = 'SMARTVIDEO_STATIC';
  let browserUsed = false;

  // Keep rendered capture strictly behind free/static extraction. RNE already
  // supports a separate Playwright/Puppeteer screenshot backend via
  // SCREENSHOT_API_URL; this avoids bundling Chromium into Netlify functions.
  if (discoveredAssets.length < 3) {
    providerAttempts.push('RENDERED_SCREENSHOT');
    const rendered = await captureRenderedScreenshotFallback(rootUrl);
    if (rendered && !discoveredAssets.some((asset) => asset.sourceUrl === rendered.sourceUrl)) {
      discoveredAssets.push(rendered);
      providerUsed = 'RENDERED_SCREENSHOT';
      browserUsed = true;
    }
  }

  return {
    providerUsed,
    providerAttempts,
    pagesCrawled: pages.length,
    rawCandidates: candidateMap.size,
    discoveredAssets,
    socialProfiles: Array.from(socialMap.values()),
    durationMs: Date.now() - startedAt,
    visionUsed: false,
    browserUsed,
    firecrawlUsed: false,
  };
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
