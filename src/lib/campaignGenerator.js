// src/lib/campaignGenerator.js
// Campaign generation — 6 goals → 4 on-brand concepts with platform-specific assets.
// Port of Open-Pomelli's campaign-generator.ts and asset-generator.ts (prompts, parsing,
// image rules). Platform ids stay the fork's own (see platforms.js).

import { muapi } from './muapi.js';
import { generateId } from './brandStore.js';
import { PLATFORMS } from './platforms.js';

export const CAMPAIGN_GOALS = [
  { value: 'product-launch', label: 'Product Launch', description: 'Announce a new product or feature' },
  { value: 'lead-gen', label: 'Lead Generation', description: 'Capture qualified prospects' },
  { value: 'awareness', label: 'Brand Awareness', description: 'Reach new audiences' },
  { value: 'engagement', label: 'Engagement', description: 'Drive replies, shares, comments' },
  { value: 'thought-leadership', label: 'Thought Leadership', description: 'Establish authority and POV' },
  { value: 'sales', label: 'Sales', description: 'Drive purchases or sign-ups' },
];

const list = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x) : []);
const joinOr = (v, sep = ', ') => list(v).join(sep) || '—';

function resolvePlatform(spec) {
  const id = typeof spec === 'string' ? spec : spec?.platform || spec?.id;
  return PLATFORMS.find((p) => p.id === id) || PLATFORMS[0];
}

function countWords(str) {
  return (str || '').trim().split(/\s+/).filter(Boolean).length;
}

export function truncateToWordCap(text, max) {
  const words = (text || '').trim().split(/\s+/).filter(Boolean);
  if (max <= 0) return '';
  return words.length > max ? words.slice(0, max).join(' ') : (text || '').trim();
}

function parseJSONObject(text) {
  const fenced = String(text || '').match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : String(text || '');
  const m = candidate.match(/\{[\s\S]*\}/);
  if (!m) throw new Error(`No JSON in response: ${String(text).slice(0, 200)}`);
  return JSON.parse(m[0]);
}

/** Campaign concepts prompt (Open-Pomelli campaign-generator.ts buildPrompt). */
export function buildCampaignPrompt(brand, goal, direction = '') {
  const goalLabel = CAMPAIGN_GOALS.find((g) => g.value === goal)?.label ?? goal;
  const platformIds = PLATFORMS.map((p) => `"${p.id}"`).join(',');

  return `You are a senior brand strategist. Generate exactly 4 distinct on-brand marketing campaign concepts for the brand below, tailored to the goal: "${goalLabel}".

Return STRICT JSON only — an array of 4 objects with this exact shape (no markdown, no commentary):
[
  {
    "title": "short evocative concept name (max 6 words)",
    "theme": "1 sentence — the strategic angle",
    "key_message": "1 sentence — what the audience should remember",
    "hook": "1 short line — the opening line of the lead asset",
    "cta": "2-4 word call to action",
    "recommended_platforms": [${platformIds}],
    "tone_notes": "how to write this concept — match the brand's voice",
    "visual_direction": "1-2 sentences — palette, imagery, layout cues"
  }
]

Keep concepts genuinely distinct in angle. Match the brand voice and palette. Be specific to the brand, not generic marketing fluff.

BRAND
- Name: ${brand.brandName || '—'}
- Industry: ${brand.industry || '—'}
- Tagline: ${brand.tagline || '—'}
- Value proposition: ${brand.valueProposition || '—'}
- Target audience: ${brand.targetAudience || '—'}
- Tone of voice: ${joinOr(brand.toneOfVoice)}
- Personality: ${joinOr(brand.brandPersonality)}
- Key messages: ${joinOr(brand.keyMessages, ' • ')}
- Primary colors: ${joinOr(brand.primaryColors)}
- Imagery style: ${brand.imageryStyle || '—'}
- Layout style: ${brand.layoutStyle || '—'}

GOAL: ${goalLabel}
${direction ? `USER DIRECTION: ${direction}` : ''}`;
}

/** Parse the model reply: fenced or bare, a JSON array (upstream) or {"concepts":[...]}. */
export function parseConcepts(text) {
  const raw = String(text || '');
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : raw;

  let arr = null;
  const obj = candidate.match(/\{[\s\S]*\}/);
  const bare = candidate.match(/\[[\s\S]*\]/);
  // Prefer whichever opens first so `{"concepts":[...]}` is not mistaken for a bare array.
  if (obj && (!bare || obj.index < bare.index)) {
    try {
      const parsed = JSON.parse(obj[0]);
      arr = Array.isArray(parsed) ? parsed : parsed.concepts;
    } catch { /* fall through to the array match */ }
  }
  if (!Array.isArray(arr) && bare) arr = JSON.parse(bare[0]);
  if (!Array.isArray(arr)) throw new Error(`No concepts array in LLM response: ${raw.slice(0, 300)}`);

  return arr.slice(0, 4).map((c) => ({
    title: String(c.title ?? c.headline ?? ''),
    theme: String(c.theme ?? ''),
    key_message: String(c.key_message ?? c.body ?? ''),
    hook: String(c.hook ?? ''),
    cta: String(c.cta ?? ''),
    recommended_platforms: list(c.recommended_platforms),
    tone_notes: String(c.tone_notes ?? ''),
    visual_direction: String(c.visual_direction ?? c.visual_prompt ?? ''),
    // Aliases the wizard UI reads.
    headline: String(c.headline ?? c.title ?? ''),
    body: String(c.body ?? c.key_message ?? ''),
    rationale: String(c.rationale ?? c.tone_notes ?? ''),
  }));
}

export async function generateCampaignConcepts(brand, goal, direction = '') {
  const raw = await muapi.text(buildCampaignPrompt(brand, goal, direction));
  return parseConcepts(raw);
}

/** Per-asset copy prompt (Open-Pomelli asset-generator.ts buildCopyPrompt). */
export function buildCopyPrompt(brand, concept, spec) {
  const platform = resolvePlatform(spec);
  const copy = platform.copy;

  return `You are writing on-brand marketing copy for a single asset. Return STRICT JSON only:
{
  "headline": "string (max ${copy.headlineMaxWords} words)",
  "body": "string (max ${copy.bodyMaxWords} words${copy.bodyMaxWords === 0 ? ' — return empty string' : ''})",
  "cta": "string (max ${copy.ctaMaxWords} words${copy.ctaMaxWords === 0 ? ' — return empty string' : ''})"
}

PLATFORM: ${platform.label}
COPY TONE: ${copy.tone}

BRAND
- Name: ${brand.brandName || '—'}
- Voice: ${joinOr(brand.toneOfVoice)}
- Personality: ${joinOr(brand.brandPersonality)}

CAMPAIGN CONCEPT
- Title: ${concept.title || concept.headline || ''}
- Theme: ${concept.theme || ''}
- Hook: ${concept.hook || ''}
- Key message: ${concept.key_message || concept.body || ''}
- Default CTA: ${concept.cta || ''}
- Tone notes: ${concept.tone_notes || ''}

Match the brand voice exactly. Stay under the word caps. Do not use hashtags in body. Do not add markdown.`;
}

/** Image prompt (Open-Pomelli asset-generator.ts buildImagePrompt). */
export function buildImagePrompt(brand, concept, spec, headline, opts = {}) {
  const platform = resolvePlatform(spec);
  const primary = list(brand.primaryColors).join(', ') || 'brand colors';
  const secondary = list(brand.secondaryColors);
  const palette = secondary.length > 0
    ? `Primary palette: ${primary}. Accent palette: ${secondary.join(', ')}.`
    : `Palette: ${primary}.`;

  const textRule = opts.noText
    ? 'IMPORTANT: render NO text, NO words, NO letters, NO typography on this image. Pure visual background only — text will be overlaid afterward in HTML. Leave generous negative space where copy can go.'
    : `Overlay headline (large, on-brand typography): "${headline || ''}"`;

  return `Marketing creative for ${platform.label}. ${platform.copy.imageHint}

Concept: ${concept.title || concept.headline || ''} — ${concept.theme || ''}
Visual direction: ${concept.visual_direction || concept.visual_prompt || ''}
Imagery style: ${brand.imageryStyle || 'modern'}. Layout style: ${brand.layoutStyle || 'modern'}.
${palette}

${textRule}

Composition rules: clean focal hierarchy, brand-consistent palette, no extraneous logos, no watermarks, no stock-photo aesthetic, no lorem ipsum. Make it feel native to the brand.`;
}

/**
 * Generate the image for an asset. Upstream sends ONLY the brand logo as the reference image
 * (image-edit) and falls back to plain text-to-image when the brand has no logo.
 */
export async function generateAssetImage(brand, prompt, platform, opts = {}) {
  const imageOpts = {
    aspectRatio: platform.aspect,
    resolution: opts.resolution || '2k',
    outputFormat: 'png',
  };
  return brand.logoUrl
    ? muapi.imageEdit2(prompt, [brand.logoUrl], imageOpts)
    : muapi.image2(prompt, imageOpts);
}

export async function generateAssetForConcept(brand, concept, platformId, opts = {}) {
  const platform = resolvePlatform(platformId);
  const caps = platform.copy;

  const copyRaw = await muapi.text(buildCopyPrompt(brand, concept, platform.id));
  const copyJson = parseJSONObject(copyRaw);

  const headline = truncateToWordCap(String(copyJson.headline ?? ''), caps.headlineMaxWords);
  const body = truncateToWordCap(String(copyJson.body ?? ''), caps.bodyMaxWords);
  const cta = truncateToWordCap(String(copyJson.cta ?? ''), caps.ctaMaxWords);

  const imagePrompt = buildImagePrompt(brand, concept, platform.id, headline, { noText: !!opts.noText });
  const imageUrl = await generateAssetImage(brand, imagePrompt, platform, opts);

  return {
    id: generateId(),
    campaignId: null,
    platform: platform.id,
    format: platform.label,
    imageUrl: imageUrl || '',
    headline,
    body,
    cta,
    variants: null,
    createdAt: new Date().toISOString(),
  };
}

export { countWords };
