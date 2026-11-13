// src/lib/campaignGenerator.js
// Campaign generation — 6 goals → 4 on-brand concepts with platform-specific assets.
// Port of Open-Pomelli's campaign-generator.ts and asset-generator.ts.

import { muapi } from './muapi.js';
import { generateId } from './brandStore.js';
import { PLATFORMS } from './platforms.js';
import { defaultLayout } from './layout.js';

export const CAMPAIGN_GOALS = [
  { value: 'product-launch', label: 'Product Launch', description: 'Announce a new product or feature' },
  { value: 'lead-gen', label: 'Lead Generation', description: 'Capture qualified prospects' },
  { value: 'awareness', label: 'Brand Awareness', description: 'Reach new audiences' },
  { value: 'engagement', label: 'Engagement', description: 'Drive replies, shares, comments' },
  { value: 'thought-leadership', label: 'Thought Leadership', description: 'Establish authority and POV' },
  { value: 'sales', label: 'Direct Sales', description: 'Drive purchases or sign-ups' },
];

const list = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x) : []);
const dash = (s) => s || '—';

function parseJSON(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const m = candidate.match(/\{[\s\S]*\}/);
  if (!m) throw new Error(`No JSON in response: ${String(text).slice(0, 200)}`);
  return JSON.parse(m[0]);
}

function truncateToWordCap(text, max) {
  const words = (text || '').trim().split(/\s+/).filter(Boolean);
  return words.length > max ? words.slice(0, max).join(' ') : (text || '').trim();
}

function buildConceptsPrompt(brand, goal, userDirection) {
  const goalLabel = CAMPAIGN_GOALS.find((g) => g.value === goal)?.label ?? goal;
  return `You are a senior brand strategist. Generate exactly 4 distinct on-brand marketing campaign concepts for the brand below, tailored to the goal: "${goalLabel}".

Return STRICT JSON only — an object with a "concepts" array of 4 objects with this exact shape (no markdown, no commentary):
{
  "concepts": [
    {
      "title": "short evocative concept name (max 6 words)",
      "theme": "1 sentence — the strategic angle",
      "key_message": "1 sentence — what the audience should remember",
      "hook": "1 short line — the opening line of the lead asset",
      "cta": "2-4 word call to action",
      "recommended_platforms": ["platform ids from: ${PLATFORMS.map((p) => p.id).join(', ')}"],
      "tone_notes": "how to write this concept — match the brand's voice",
      "visual_direction": "1-2 sentences — palette, imagery, layout cues"
    }
  ]
}

Keep concepts genuinely distinct in angle. Match the brand voice and palette. Be specific to the brand, not generic marketing fluff.

BRAND
- Name: ${dash(brand.brandName)}
- Industry: ${dash(brand.industry)}
- Tagline: ${dash(brand.tagline)}
- Value proposition: ${dash(brand.valueProposition)}
- Target audience: ${dash(brand.targetAudience)}
- Tone of voice: ${list(brand.toneOfVoice).join(', ') || '—'}
- Personality: ${list(brand.brandPersonality).join(', ') || '—'}
- Key messages: ${list(brand.keyMessages).join(' • ') || '—'}
- Primary colors: ${list(brand.primaryColors).join(', ') || '—'}
- Imagery style: ${dash(brand.imageryStyle)}
- Layout style: ${dash(brand.layoutStyle)}

GOAL: ${goalLabel}
${userDirection ? `USER DIRECTION: ${userDirection}` : ''}`;
}

export async function generateCampaignConcepts(brand, goal, direction = '') {
  const raw = await muapi.text(buildConceptsPrompt(brand, goal, direction));
  const parsed = parseJSON(raw);
  const concepts = Array.isArray(parsed.concepts) ? parsed.concepts : [];
  if (concepts.length === 0) throw new Error('Concepts response had no concepts');

  return concepts.slice(0, 4).map((c) => ({
    title: String(c.title ?? c.headline ?? ''),
    theme: String(c.theme ?? ''),
    key_message: String(c.key_message ?? c.body ?? ''),
    hook: String(c.hook ?? ''),
    cta: String(c.cta ?? ''),
    recommended_platforms: list(c.recommended_platforms),
    tone_notes: String(c.tone_notes ?? ''),
    visual_direction: String(c.visual_direction ?? c.visual_prompt ?? ''),
    // Kept for the campaign page / older saved concepts.
    headline: String(c.headline ?? c.title ?? ''),
    body: String(c.body ?? c.key_message ?? ''),
    rationale: String(c.rationale ?? c.tone_notes ?? ''),
  }));
}

export function buildCopyPrompt(brand, concept, spec) {
  const platform = PLATFORMS.find((p) => p.id === spec.platform) || PLATFORMS[0];
  const copy = platform.copy || {};
  const hm = copy.headlineMaxWords ?? 8;
  const bm = copy.bodyMaxWords ?? 40;
  const cm = copy.ctaMaxWords ?? 3;

  return `You are writing on-brand marketing copy for a single asset. Return STRICT JSON only:
{
  "headline": "string (max ${hm} words)",
  "body": "string (max ${bm} words${bm === 0 ? ' — return empty string' : ''})",
  "cta": "string (max ${cm} words${cm === 0 ? ' — return empty string' : ''})"
}

PLATFORM: ${platform.label}
COPY TONE: ${copy.tone || 'on-brand'}

BRAND
- Name: ${dash(brand.brandName)}
- Voice: ${list(brand.toneOfVoice).join(', ') || '—'}
- Personality: ${list(brand.brandPersonality).join(', ') || '—'}

CAMPAIGN CONCEPT
- Title: ${dash(concept.title)}
- Theme: ${dash(concept.theme)}
- Hook: ${dash(concept.hook)}
- Key message: ${dash(concept.key_message || concept.body)}
- Default CTA: ${dash(concept.cta)}
- Tone notes: ${dash(concept.tone_notes)}

Match the brand voice exactly. Stay under the word caps. Do not use hashtags in body. Do not add markdown.`;
}

export function buildImagePrompt(brand, concept, spec, headline, opts = {}) {
  const platform = PLATFORMS.find((p) => p.id === spec.platform) || PLATFORMS[0];
  const primary = list(brand.primaryColors).join(', ') || 'brand colors';
  const secondary = list(brand.secondaryColors);
  const palette = secondary.length > 0
    ? `Primary palette: ${primary}. Accent palette: ${secondary.join(', ')}.`
    : `Palette: ${primary}.`;

  const textRule = opts.noText
    ? 'IMPORTANT: render NO text, NO words, NO letters, NO typography on this image. Pure visual background only — text will be overlaid afterward in HTML. Leave generous negative space where copy can go.'
    : `Overlay headline (large, on-brand typography): "${headline}"`;

  return `Marketing creative for ${platform.label}. ${platform.copy?.imageHint || ''}

Concept: ${concept.title || ''} — ${concept.theme || ''}
Visual direction: ${concept.visual_direction || concept.visual_prompt || ''}
Imagery style: ${brand.imageryStyle || 'modern'}. Layout style: ${brand.layoutStyle || 'modern'}.
${palette}

${textRule}

Composition rules: clean focal hierarchy, brand-consistent palette, no extraneous logos, no watermarks, no stock-photo aesthetic, no lorem ipsum. Make it feel native to the brand.`;
}

/** The logo (when detected) is passed as a reference image so the creative stays on-brand. */
async function renderImage(brand, platformMeta, imagePrompt) {
  const refs = brand.logoUrl ? [brand.logoUrl] : [];
  return refs.length > 0
    ? muapi.imageEdit(imagePrompt, refs, platformMeta.aspect)
    : muapi.image(imagePrompt, platformMeta.aspect);
}

/** New background for an existing asset ("Swap image"), or a text-free one for the canvas editor ("Clean background"). */
export async function regenerateImage(brand, concept, platform, headline, opts = {}) {
  const platformMeta = PLATFORMS.find((p) => p.id === platform) || PLATFORMS[0];
  const imagePrompt = buildImagePrompt(brand, concept, { platform: platformMeta.id }, headline, opts);
  return renderImage(brand, platformMeta, imagePrompt);
}

export async function generateAssetForConcept(brand, concept, platform, opts = {}) {
  const platformMeta = PLATFORMS.find((p) => p.id === platform) || PLATFORMS[0];
  const copyConstraints = platformMeta.copy || {};

  const copyRaw = await muapi.text(buildCopyPrompt(brand, concept, { platform: platformMeta.id }));
  const copyJson = parseJSON(copyRaw);

  const headline = truncateToWordCap(String(copyJson.headline ?? ''), copyConstraints.headlineMaxWords ?? 999);
  const body = truncateToWordCap(String(copyJson.body ?? ''), copyConstraints.bodyMaxWords ?? 9999);
  const cta = truncateToWordCap(String(copyJson.cta ?? ''), copyConstraints.ctaMaxWords ?? 999);

  // The copy is laid over the picture by the canvas editor, so the picture itself carries no text.
  const imageUrl = await renderImage(
    brand,
    platformMeta,
    buildImagePrompt(brand, concept, { platform: platformMeta.id }, headline, { noText: opts.noText ?? true }),
  );

  const fontFamily = (brand.fonts || []).find((f) => f && !/^-/.test(f) && !/^system-ui$/i.test(f));
  return {
    id: generateId(),
    campaignId: null,
    platform: platformMeta.id,
    format: platformMeta.label,
    imageUrl: imageUrl || '',
    headline,
    body,
    cta,
    layout: defaultLayout(headline, body, cta, fontFamily ? `${fontFamily}, system-ui, sans-serif` : 'system-ui, sans-serif'),
    // Which concept/platform made this asset, so the editor can regenerate its image.
    variants: { conceptIndex: concept.index ?? 0, platformId: platformMeta.id },
    createdAt: new Date().toISOString(),
  };
}
