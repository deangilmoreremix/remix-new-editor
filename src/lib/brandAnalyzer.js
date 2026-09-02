// src/lib/brandAnalyzer.js
// Brand DNA extraction — ports Open-Pomelli's brand-analyzer.ts.
// Uses the repo's existing MuapiClient (proxied through Supabase edge functions).

import { muapi } from './muapi.js';
import { generateId } from './brandStore.js';
import { pickPalette } from './colors.js';

const TEXT_PROMPT = `You are a brand analyst. Given the website content below, extract the brand DNA as STRICT JSON only (no commentary, no markdown). Use this exact shape:
{
  "brand_name": "string",
  "industry": "string",
  "tagline": "string",
  "value_proposition": "string",
  "tone_of_voice": ["3-5 trait words"],
  "brand_personality": ["3-5 trait words"],
  "target_audience": "one sentence",
  "key_messages": ["3-5 short messages"],
  "imagery_style": "professional | casual | illustrated | cinematic | minimalist | editorial",
  "layout_style": "modern | classic | minimalist | bold | editorial"
}

WEBSITE TITLE: {{title}}
META DESCRIPTION: {{description}}
BODY TEXT (truncated):
{{body}}`;

const VISION_PROMPT = `Analyze this website screenshot and return STRICT JSON only (no markdown, no commentary):
{
  "primary_colors": ["#hex","#hex","#hex"],
  "secondary_colors": ["#hex","#hex"],
  "typography": "serif | sans-serif | modern | classic | display",
  "logo_style": "wordmark | icon | combination",
  "imagery_style": "professional | casual | illustrated | cinematic | minimalist | editorial",
  "layout_style": "modern | classic | minimalist | bold | editorial",
  "brand_vibe": ["3-5 vibe words"]
}`;

function parseJSON(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const m = candidate.match(/\{[\s\S]*\}/);
  if (!m) throw new Error(`No JSON in LLM response: ${text.slice(0, 200)}`);
  return JSON.parse(m[0]);
}
export { parseJSON };

const asString = (v, fallback = '') => (typeof v === 'string' ? v : fallback);
export { asString };
const asStringArray = (v) =>
  Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
export { asStringArray };

function dedupHex(...lists) {
  const out = [];
  for (const list of lists) {
    for (const c of list) {
      if (c && !out.includes(c.toLowerCase())) out.push(c.toLowerCase());
    }
  }
  return out;
}

export { dedupHex };

// Production scraper — calls the backend /api/scrape endpoint.
// Falls back to a minimal stub if the backend is unreachable.
export async function scrapeSite(url) {
  const backendBase = (import.meta.env?.VITE_BACKEND_URL || '').replace(/\/$/, '');
  const scrapeUrl = backendBase ? `${backendBase}/api/scrape` : '/api/scrape';

  try {
    const res = await fetch(scrapeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    if (!res.ok) {
      throw new Error(`Scrape endpoint returned ${res.status}`);
    }

    const json = await res.json();
    if (!json.ok || !json.data) {
      throw new Error(json.error || 'Invalid scrape response');
    }

    const d = json.data;
    return {
      url: d.url || url,
      title: d.title || '',
      description: d.description || '',
      bodyText: d.bodyText || '',
      ogImage: d.ogImage || null,
      favicon: d.favicon || null,
      logoCandidates: d.logoCandidates || [],
      fonts: d.fonts || [],
      rawColors: d.rawColors || [],
      screenshot: d.screenshot || null,
    };
  } catch (e) {
    console.warn('[brandAnalyzer] scrape failed, falling back to minimal:', e.message);
    return {
      url,
      title: '',
      description: '',
      bodyText: '',
      ogImage: null,
      favicon: null,
      logoCandidates: [],
      fonts: [],
      rawColors: [],
      screenshot: null,
    };
  }
}

export async function analyzeBrand(url) {
  const site = await scrapeSite(url);

  // If scraping failed, create a minimal DNA from the URL alone
  if (!site.title && !site.bodyText) {
    return {
      id: generateId(),
      url,
      brandName: new URL(url).hostname.replace(/^www\./, ''),
      industry: 'Unknown',
      tagline: '',
      valueProposition: '',
      toneOfVoice: ['modern'],
      brandPersonality: ['clean'],
      targetAudience: 'General audience',
      keyMessages: [],
      primaryColors: ['#000000'],
      secondaryColors: ['#ffffff'],
      fonts: [],
      logoUrl: null,
      screenshotUrl: null,
      imageryStyle: 'modern',
      layoutStyle: 'modern',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  let screenshotUrl = null;
  if (site.screenshot) {
    try {
      screenshotUrl = await muapi.uploadBrandAsset(site.screenshot, `screenshot-${Date.now()}.png`, 'image/png');
    } catch (e) {
      console.warn('[brandAnalyzer] screenshot upload failed:', e);
    }
  }

  const textPrompt = TEXT_PROMPT
    .replace('{{title}}', site.title)
    .replace('{{description}}', site.description)
    .replace('{{body}}', site.bodyText);

  const [textRaw, visionRaw] = await Promise.all([
    muapi.text(textPrompt),
    screenshotUrl ? muapi.vision(VISION_PROMPT, screenshotUrl) : Promise.resolve('{}'),
  ]);

  const text = parseJSON(textRaw);
  const vision = parseJSON(visionRaw);

  const sitePalette = pickPalette(site.rawColors);
  const primaryColors = dedupHex(sitePalette.primary, asStringArray(vision.primary_colors)).slice(0, 5);
  const secondaryColors = dedupHex(sitePalette.secondary, asStringArray(vision.secondary_colors)).slice(0, 5);

  const logoUrl = site.logoCandidates[0] || site.ogImage || site.favicon;

  const brandName = asString(text.brand_name) || new URL(url).hostname.replace(/^www\./, '');

  return {
    id: generateId(),
    url,
    brandName,
    industry: asString(text.industry),
    tagline: asString(text.tagline),
    valueProposition: asString(text.value_proposition),
    toneOfVoice: asStringArray(text.tone_of_voice),
      brandPersonality: [...new Set([...asStringArray(text.brand_personality), ...asStringArray(vision.brand_vibe)])],
    targetAudience: asString(text.target_audience),
    keyMessages: asStringArray(text.key_messages),
    primaryColors,
    secondaryColors,
    fonts: site.fonts,
    logoUrl,
    screenshotUrl,
    imageryStyle: asString(vision.imagery_style) || asString(text.imagery_style),
    layoutStyle: asString(vision.layout_style) || asString(text.layout_style),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
