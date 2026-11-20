// src/lib/onboarding/brandPrefill.js
//
// After the onboarding, the website the person gave becomes a first brand (logo, colors, name, photos) so Brand
// Studio and the other studios start with something. It uses the free, key-less POST /api/demo/discover (the same
// call as "Find My Brand"), never a browser fetch of the raw URL. Silent and best effort: a busy server (429/503),
// no network, or an existing brand all just mean "nothing saved". The full AI analysis stays in Brand Studio.
import { listBrands, saveBrand, generateId } from '../brandStore.js';
import { normalizeWebsite } from './store.js';

const hex = (v) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v.trim()) ? v.trim().toLowerCase() : null);
const text = (v, n) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '');
const httpUrl = (v) => (typeof v === 'string' && /^https?:\/\//i.test(v) ? v : '');

/** Maps a /api/demo/discover answer to a Brand record (same shape Brand Studio saves), or null when unusable. */
export function brandFromDiscovery(data, websiteUrl) {
  if (!data || data.ok !== true) return null;
  let host = '';
  try { host = new URL(websiteUrl).hostname.replace(/^www\./, ''); } catch { return null; }
  const pal = data.brandColors || {};
  const colors = [...new Set([pal.primary, pal.accent, ...(Array.isArray(pal.palette) ? pal.palette : [])].map(hex).filter(Boolean))];
  const assets = Array.isArray(data.assets) ? data.assets : [];
  const images = [...new Set(assets.map((a) => httpUrl(a?.previewUrl) || httpUrl(a?.sourceUrl)).filter(Boolean))].slice(0, 12);
  const now = new Date().toISOString();
  return {
    id: generateId(),
    url: websiteUrl,
    brandName: text(data.title, 80) || host,
    industry: '', tagline: '',
    valueProposition: text(data.description, 300),
    toneOfVoice: [], brandPersonality: [], targetAudience: '', keyMessages: [],
    primaryColors: colors.slice(0, 3), secondaryColors: colors.slice(3, 6),
    fonts: [],
    logoUrl: httpUrl(data.logo),
    screenshotUrl: null,
    siteImages: images, siteVideos: [],
    imageryStyle: '', layoutStyle: '',
    source: 'onboarding',
    createdAt: now, updatedAt: now,
  };
}

/**
 * prefillBrandFromWebsite(website) -> the saved brand, or null. Skips when there is no usable website or any brand
 * already exists (never overwrites the person's own work).
 */
export async function prefillBrandFromWebsite(website, { fetchImpl = (...a) => globalThis.fetch(...a), brands = listBrands, save = saveBrand } = {}) {
  try {
    const host = normalizeWebsite(website);
    if (!host || brands().length) return null;
    const url = `https://${host}`;
    const res = await fetchImpl('/api/demo/discover', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ websiteUrl: url }),
    });
    if (!res?.ok) return null;
    const brand = brandFromDiscovery(await res.json(), url);
    if (!brand || brands().length) return null; // re-check: they may have made one while we waited
    return save(brand);
  } catch { return null; }
}

// The onboarding reloads the page as it ends, which would cut the request short, so it only leaves a note here and
// the app (main.js) runs it once the next page is up.
const NOTE_KEY = 'smartvideo-brand-prefill';
export function stageBrandPrefill(website, storage = globalThis.localStorage) {
  if (!normalizeWebsite(website)) return false;
  try { storage?.setItem(NOTE_KEY, JSON.stringify({ website, at: Date.now() })); return true; } catch { return false; }
}
export async function runStagedBrandPrefill(opts = {}, storage = globalThis.localStorage) {
  let note = null;
  try { note = JSON.parse(storage?.getItem(NOTE_KEY) || 'null'); } catch { note = null; }
  if (!note) return null;
  try { storage.removeItem(NOTE_KEY); } catch { /* ignore */ }
  if (!note.at || Date.now() - note.at > 60 * 60 * 1000) return null;
  return prefillBrandFromWebsite(note.website, opts);
}
