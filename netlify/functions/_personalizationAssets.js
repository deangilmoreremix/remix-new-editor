import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 15000;
const MAX_REDIRECTS = 5;
const DEFAULT_MAX_PAGES = 6;
const DEFAULT_MAX_IMAGES = 60;

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

async function fetchWithRedirectGuards(inputUrl, options = {}, maxBytes = MAX_HTML_BYTES) {
  let current = await sanitizePublicHttpUrl(inputUrl);
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
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

async function validateImageCandidate(candidate) {
  try {
    const safeUrl = await sanitizePublicHttpUrl(candidate.url);
    let checked = await fetchWithRedirectGuards(safeUrl, {
      method: 'HEAD',
      headers: { Accept: 'image/*' },
    }, MAX_IMAGE_BYTES);
    if (!checked.response.ok || !String(checked.response.headers.get('content-type') || '').toLowerCase().startsWith('image/')) {
      checked = await fetchWithRedirectGuards(safeUrl, {
        method: 'GET',
        headers: { Accept: 'image/*', Range: 'bytes=0-2047' },
      }, MAX_IMAGE_BYTES);
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
  for (const candidate of candidateMap.values()) {
    if (discoveredAssets.length >= imageLimit) break;
    const valid = await validateImageCandidate(candidate);
    if (!valid) continue;
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
  }

  return {
    providerUsed: 'SMARTVIDEO_STATIC',
    providerAttempts: ['SMARTVIDEO_STATIC'],
    pagesCrawled: pages.length,
    rawCandidates: candidateMap.size,
    discoveredAssets,
    socialProfiles: Array.from(socialMap.values()),
    durationMs: Date.now() - startedAt,
    visionUsed: false,
    browserUsed: false,
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
