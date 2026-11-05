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

// Production scraper — uses the same Netlify function as the personalization
// modal / business asset finder (/api/personalizer/brand-scrape, Supabase auth).
// Falls back to a minimal stub if the scraper is unreachable.
const SCRAPE_URL = '/api/personalizer/brand-scrape';

async function getAccessToken() {
  try {
    const { supabase } = await import('./supabase.js');
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  } catch {
    return null;
  }
}

export async function scrapeSite(url) {
  try {
    const token = await getAccessToken();
    if (!token) throw new Error('Sign in required for website scraping');

    const res = await fetch(SCRAPE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
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
    console.warn(`[brandAnalyzer] scrape via ${SCRAPE_URL} failed, falling back to minimal:`, e.message);
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

  // No scrape backend reachable (static hosting, local dev): let the model
  // work from the URL itself instead of returning an empty placeholder DNA.
  const scraped = !!(site.title || site.bodyText);
  if (!scraped) {
    const host = new URL(url).hostname.replace(/^www\./, '');
    site.title = host;
    site.description = `Website: ${url}`;
    site.bodyText = `The page content could not be fetched. Infer the brand DNA for ${url} (${host}) from the domain name and anything you know about this company. Keep answers plausible and specific.`;
    site.favicon = `${new URL(url).origin}/favicon.ico`;
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
