// src/lib/brandKit.js
// "Brand Kit": what Find My Brand found about a business (logo, palette, copy, socials, images),
// saved once as a Brand DNA record (lib/brandStore.js) so every studio that reads brands can use it,
// plus a one-click "make an ad" that turns the kit into a Video Studio brief.
//
// Pure, offline helpers: nothing here fetches. Nothing is invented: a field with no source stays empty.

import { generateId, listBrands, saveBrand } from './brandStore.js';
import { stageStudioPrefill } from './studioPrefill.js';
import { navigate } from './router.js';

const HEX = /^#?([0-9a-f]{6})$/i;
const MAX_IMAGES = 12;
const DURATIONS = [8, 15, 30];

const str = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
const hex = (v) => { const m = HEX.exec(str(v)); return m ? `#${m[1].toLowerCase()}` : ''; };
const uniq = (list) => [...new Set(list.filter(Boolean))];
const httpUrl = (v) => {
  try { const u = new URL(str(v)); return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : ''; } catch { return ''; }
};

export function hostOf(url) {
  try { return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
}

/**
 * Build a Brand DNA record from a Find My Brand result.
 * @param {{ research?: object, client?: object, assets?: object[] }} input
 *   research: BusinessResearchResult; client: the modal's client form; assets: DiscoveredAsset[]
 * @returns {object|null} null when there is nothing usable (no name and no website).
 */
export function buildBrandKit({ research = {}, client = {}, assets = [] } = {}) {
  const url = httpUrl(research.canonicalUrl || research.finalUrl) || httpUrl(client.website);
  const host = hostOf(url || client.website || '');
  const brandName = str(client.businessName) || str(research.title).split(/[|\-–—]/)[0].trim() || host;
  if (!brandName && !host) return null;

  const colors = research.brandColors || client.brandColors || {};
  const palette = uniq([hex(colors.primary), hex(colors.accent), ...(colors.palette || []).map(hex)]);
  const primaryColors = palette.slice(0, 2);
  const secondaryColors = palette.slice(2, 5);

  // Kept images: not rejected, an image we can load, best (selected/recommended, quality) first.
  const usable = assets
    .filter((a) => a && !a.rejected && a.category !== 'irrelevant' && httpUrl(a.previewUrl || a.sourceUrl))
    .sort((a, b) => (Number(b.selected) - Number(a.selected)) || (Number(b.recommended) - Number(a.recommended))
      || ((b.qualityScore || 0) - (a.qualityScore || 0)));
  const urlOf = (a) => httpUrl(a.editedDataUrl ? a.sourceUrl : (a.previewUrl || a.sourceUrl));
  const logoAsset = usable.find((a) => a.category === 'logo');
  const logoUrl = httpUrl(research.brandingAssets?.logoUrl || research.logoUrl) || (logoAsset ? urlOf(logoAsset) : '');
  const byCat = (...cats) => usable.filter((a) => cats.includes(a.category)).map(urlOf).filter(Boolean);
  const productImages = uniq(byCat('product', 'service', 'completed_work')).slice(0, MAX_IMAGES);
  const peopleImages = uniq(byCat('person', 'team')).slice(0, MAX_IMAGES);
  const placeImages = uniq(byCat('storefront', 'office', 'branded_vehicle', 'brand')).slice(0, MAX_IMAGES);
  const siteImages = uniq([...productImages, ...placeImages, ...peopleImages,
    ...(research.brandingAssets?.imageUrls || []).map(httpUrl)]).slice(0, MAX_IMAGES * 2);

  const description = str(client.brandDescription) || str(research.description) || str(research.openGraph?.['og:description']);
  const socials = {};
  for (const k of ['facebook', 'instagram', 'linkedin', 'youtube', 'tiktok', 'x', 'pinterest']) {
    const v = httpUrl(client[k] || research.socialLinks?.[k]);
    if (v) socials[k] = v;
  }

  return {
    id: '',
    url: url || (host ? `https://${host}` : ''),
    brandName,
    industry: str(client.industry),
    tagline: str(client.ctaHeadline),
    valueProposition: description,
    toneOfVoice: [],
    brandPersonality: [],
    targetAudience: '',
    keyMessages: uniq([str(client.offer), str(client.productService)]),
    primaryColors,
    secondaryColors,
    fonts: [],
    logoUrl,
    screenshotUrl: '',
    siteImages,
    siteVideos: [],
    imageryStyle: '',
    layoutStyle: '',
    // Extras the ad builder and other studios can read.
    offer: str(client.offer),
    productService: str(client.productService),
    callToAction: str(client.callToAction),
    location: str(client.location),
    website: url,
    contact: { phone: str(client.phone), email: str(client.email) },
    socials,
    productImages,
    peopleImages,
    placeImages,
    source: 'find-my-brand',
  };
}

/** Save a kit as a Brand DNA record, reusing the record of the same website so re-running updates it. */
export function saveBrandKit(kit) {
  if (!kit) return null;
  const host = hostOf(kit.url);
  const existing = host ? listBrands().find((b) => hostOf(b.url) === host) : null;
  const now = new Date().toISOString();
  const merged = existing
    ? { ...existing, ...Object.fromEntries(Object.entries(kit).filter(([, v]) => !(v === '' || (Array.isArray(v) && v.length === 0)))), id: existing.id, createdAt: existing.createdAt }
    : { ...kit, id: generateId(), createdAt: now };
  return saveBrand(merged);
}

/**
 * The ad brief for a kit: a Video Studio prompt built only from what the site said, plus the start image
 * and aspect ratio. `duration` is 8, 15 or 30 seconds; `aspectRatio` is '9:16' or '16:9'.
 */
export function buildBrandAdPlan(brand, { duration = 15, aspectRatio = '9:16', goal = '' } = {}) {
  if (!brand) return null;
  const secs = DURATIONS.includes(duration) ? duration : 15;
  const name = str(brand.brandName) || hostOf(brand.url);
  const offer = str(brand.offer) || str(brand.keyMessages?.[0]);
  const what = str(brand.productService) || str(brand.industry);
  const colors = uniq([...(brand.primaryColors || []), ...(brand.secondaryColors || [])]).slice(0, 4);
  const hero = brand.productImages?.[0] || brand.placeImages?.[0] || brand.peopleImages?.[0] || brand.siteImages?.[0] || '';
  const cta = str(brand.callToAction) || (brand.website ? `Visit ${hostOf(brand.website)}` : '');

  const lines = [
    `A ${secs}-second ${aspectRatio === '9:16' ? 'vertical' : 'widescreen'} promotional video for ${name}${what ? `, ${what}` : ''}${brand.location ? ` in ${str(brand.location)}` : ''}.`,
    str(brand.valueProposition) && `About the business: ${str(brand.valueProposition)}`,
    offer && `Key message: ${offer}.`,
    brand.offerings?.length && `Feature what they offer: ${brand.offerings.slice(0, 4).join(', ')}.`,
    brand.toneOfVoice?.length && `Tone of voice: ${brand.toneOfVoice.join(', ')}${brand.brandPersonality?.length ? ` (${brand.brandPersonality.join('; ')})` : ''}.`,
    brand.fonts?.length && `Brand typography: ${brand.fonts.slice(0, 2).join(' and ')}.`,
    str(goal) && `Goal: ${str(goal)}.`,
    colors.length && `Use the brand colors ${colors.join(', ')} for graphics and text.`,
    brand.logoUrl && 'Show the brand logo clearly in the final shot.',
    `Open with a strong hook in the first 2 seconds, keep a steady, professional pace, and end on a clear call to action${cta ? `: "${cta}"` : ''}.`,
    hero && 'Start from the supplied brand image and keep the subject and styling true to it.',
  ].filter(Boolean);

  return { prompt: lines.join(' '), referenceImageUrl: hero, aspectRatio, duration: secs, brandId: brand.id || '' };
}

/** Studios a Brand Kit can start a project in. */
export const BRAND_TARGETS = {
  video: { label: 'Video Studio', route: 'video' },
  cinema: { label: 'Cinema Studio', route: 'cinema' },
  storyboard: { label: 'Storyboard Studio', route: 'storyboard' },
  'video-agent': { label: 'Video Agent', route: 'video-agent' },
};

const brandFacts = (brand) => {
  const plan = buildBrandAdPlan(brand, {});
  return plan ? { plan, name: str(brand.brandName) || hostOf(brand.url) } : null;
};

/**
 * The brief for one studio, built only from the kit. Video: the ad brief. Cinema: one hero shot.
 * Storyboard: a short scene outline. Video Agent: an on-brand motion-graphics brief (colors, fonts, logo, copy).
 */
export function buildBrandBrief(brand, target = 'video', options = {}) {
  const facts = brandFacts(brand);
  if (!facts) return null;
  const base = buildBrandAdPlan(brand, options);
  const { name } = facts;
  const what = str(brand.productService) || str(brand.industry) || 'the business';
  const colors = uniq([...(brand.primaryColors || []), ...(brand.secondaryColors || [])]).slice(0, 4);
  const tone = brand.toneOfVoice?.length ? ` The feeling is ${brand.toneOfVoice.join(', ')}.` : '';
  const offer = str(brand.offer) || str(brand.keyMessages?.[0]);
  const cta = str(brand.callToAction) || (brand.website ? `Visit ${hostOf(brand.website)}` : '');
  if (target === 'cinema') {
    return { ...base, prompt: `A cinematic hero shot for ${name}, ${what}. Real camera, shallow depth of field, natural light, premium commercial look; the subject true to the supplied brand image.${colors.length ? ` Color palette inspired by ${colors.join(', ')}.` : ''}${tone}`, duration: undefined };
  }
  if (target === 'storyboard') {
    const feature = (brand.offerings || []).slice(0, 2);
    const proof = str(brand.testimonials?.[0]);
    return { ...base, prompt: [
      `A ${base.duration}-second ${base.aspectRatio === '9:16' ? 'vertical' : 'widescreen'} promo for ${name} (${what}) in 5 scenes:`,
      `1) A hook that shows the problem or desire. 2) ${feature[0] ? `Show ${feature[0]}.` : 'Show the product or service in action.'} 3) ${feature[1] ? `Show ${feature[1]}.` : 'Show the result.'}`,
      proof ? `4) A customer moment: "${proof.slice(0, 120)}".` : '4) A happy customer moment.',
      `5) ${offer ? `${offer}. ` : ''}End on the logo and "${cta || name}".${tone}`,
    ].join(' ') };
  }
  if (target === 'video-agent') {
    return { ...base, prompt: [
      `Create a ${base.duration}-second ${base.aspectRatio === '9:16' ? 'vertical' : 'widescreen'} animated promo for ${name} (${what}).`,
      colors.length && `Use exactly these brand colors: ${colors.join(', ')}.`,
      brand.fonts?.length && `Use ${brand.fonts.slice(0, 2).join(' and ')} for text.`,
      offer && `Headline: ${offer}.`,
      brand.offerings?.length && `Animate these as short callouts: ${brand.offerings.slice(0, 4).join(', ')}.`,
      `Finish on a clear call to action${cta ? `: "${cta}"` : ''}${brand.logoUrl ? ' and the brand logo' : ''}.${tone}`,
    ].filter(Boolean).join(' '), referenceImageUrl: '' };
  }
  return base;
}

/** Open a studio with the brand's brief filled in. The user still presses Generate (Video Agent starts writing at once). */
export function makeBrandProject(brand, target = 'video', options = {}) {
  const dest = BRAND_TARGETS[target];
  const plan = dest && buildBrandBrief(brand, target, options);
  if (!plan) return null;
  if (target === 'cinema') {
    try { localStorage.setItem('prefill_prompt', plan.prompt); } catch { /* storage unavailable */ }
  } else {
    stageStudioPrefill({
      route: dest.route,
      prompt: plan.prompt,
      params: { referenceImageUrl: plan.referenceImageUrl || undefined, aspectRatio: plan.aspectRatio, brandId: plan.brandId },
      autoGenerate: false,
    });
  }
  navigate(dest.route);
  return plan;
}

/** Open Video Studio with the brand's ad brief filled in. */
export const makeBrandAd = (brand, options = {}) => makeBrandProject(brand, 'video', options);

const unionList = (a, b, max) => [...new Set([...(a || []), ...(b || [])].filter(Boolean))].slice(0, max);

/** Pure: fold a deep-scan profile (from /api/brand-kit) into a brand record. Empty results never wipe what is there. */
export function mergeBrandProfile(brand, profile) {
  if (!brand || !profile) return brand;
  const pick = (cur, next) => (Array.isArray(next) && next.length ? next : cur);
  return {
    ...brand,
    fonts: pick(brand.fonts, profile.fonts),
    toneOfVoice: pick(brand.toneOfVoice, profile.toneOfVoice),
    brandPersonality: pick(brand.brandPersonality, profile.brandPersonality),
    offerings: pick(brand.offerings, profile.offerings),
    testimonials: pick(brand.testimonials, profile.testimonials),
    aboutText: str(profile.aboutText) || brand.aboutText || '',
    siteImages: unionList(brand.siteImages, (profile.images || []).map(httpUrl), 40),
    scannedPages: Array.isArray(profile.pages) ? profile.pages.map((p) => ({ url: p.url, kind: p.kind })) : brand.scannedPages,
    inferredFields: Array.isArray(profile.inferred) ? profile.inferred : brand.inferredFields || [],
    deepScannedAt: new Date().toISOString(),
  };
}

/** Deep scan: reads the site's About / Products / Reviews pages for fonts, tone, offerings and testimonials. */
export async function enrichBrandKit(brand, fetchImpl = (typeof fetch === 'function' ? fetch : null)) {
  const url = brand?.website || brand?.url;
  if (!url || !fetchImpl) throw new Error('This brand has no website to scan');
  const res = await fetchImpl('/api/brand-kit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) throw new Error(data?.error || 'Could not scan that website');
  return mergeBrandProfile(brand, data.profile);
}

/** Save the kit, deep-scan its website, and save the richer record. Resolves to the saved brand. */
export async function scanAndSaveBrandKit(kit, fetchImpl) {
  const saved = saveBrandKit(kit);
  if (!saved) throw new Error('Nothing to save yet');
  return saveBrand(await enrichBrandKit(saved, fetchImpl));
}

const DEMO_KIND_TO_CATEGORY = { logo: 'logo', product: 'product', photo: 'person', brand: 'brand' };

/**
 * Pure: turn the free `/api/demo/discover` response into the research and asset lists `buildBrandKit` reads.
 * Returns null when the response is not the expected shape.
 */
export function kitInputFromDiscovery(data) {
  if (!data || data.ok !== true || !Array.isArray(data.assets)) return null;
  const research = {
    canonicalUrl: str(data.url),
    title: str(data.title),
    description: str(data.description),
    logoUrl: httpUrl(data.logo),
    brandColors: data.brandColors && typeof data.brandColors === 'object' ? data.brandColors : {},
  };
  const assets = data.assets
    .filter((a) => a && httpUrl(a.url))
    .map((a, i) => ({
      id: `found-${i}`,
      previewUrl: httpUrl(a.url),
      sourceUrl: httpUrl(a.url),
      category: DEMO_KIND_TO_CATEGORY[a.kind] || 'brand',
      selected: true,
      recommended: true,
      rejected: false,
    }));
  return { research, assets };
}

/** Find a business's brand on its website (the free discovery endpoint). Throws a readable Error on failure. */
export async function discoverBrand(websiteUrl, fetchImpl = (typeof fetch === 'function' ? fetch : null)) {
  const url = str(websiteUrl);
  if (!url) throw new Error('Enter a business website');
  if (!fetchImpl) throw new Error('Not available here');
  let res;
  try {
    res = await fetchImpl('/api/demo/discover', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ websiteUrl: url }),
      credentials: 'same-origin',
    });
  } catch {
    throw new Error('Website research failed. Please try again.');
  }
  const data = await res.json().catch(() => null);
  if (res.status === 429) throw new Error('Too many lookups right now. Please try again in a minute.');
  if (!res.ok) throw new Error(str(data?.error) || `Website research failed (HTTP ${res.status}).`);
  const input = kitInputFromDiscovery(data);
  if (!input) throw new Error('Website research returned an unexpected response.');
  if (input.assets.length === 0 && !input.research.title) throw new Error('Nothing was found on that website. Try another URL.');
  return input;
}
