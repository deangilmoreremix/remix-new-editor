// src/lib/campaignGenerator.js
// Campaign generation — 6 goals → 4 on-brand concepts with platform-specific assets.
// Port of Open-Pomelli's campaign-generator.ts and asset-generator.ts.

import { muapi } from './muapi.js';
import { generateId } from './brandStore.js';
import { PLATFORMS } from './platforms.js';

export const CAMPAIGN_GOALS = [
  { value: 'product-launch', label: 'Product Launch' },
  { value: 'lead-gen', label: 'Lead Generation' },
  { value: 'awareness', label: 'Brand Awareness' },
  { value: 'engagement', label: 'Engagement' },
  { value: 'thought-leadership', label: 'Thought Leadership' },
  { value: 'sales', label: 'Sales' },
];

const CAMPAIGN_PROMPT = `You are a creative director. Given the brand DNA below and the campaign goal, generate 4 distinct campaign concepts as STRICT JSON (no markdown, no commentary):

{
  "concepts": [
    {
      "title": "string — short internal concept name",
      "theme": "string — visual/emotional theme",
      "key_message": "string — the single most important message",
      "hook": "string — attention-grabbing opener",
      "cta": "string — call to action",
      "recommended_platforms": ["string — platform ids from: instagram-feed, instagram-story, linkedin, facebook, twitter, web-banner, email, youtube"],
      "tone_notes": "string — guidance for copy and visual tone",
      "visual_direction": "string — detailed prompt for the hero image"
    }
  ]
}

BRAND: {{brandName}}
INDUSTRY: {{industry}}
TAGLINE: {{tagline}}
TONE: {{tone}}
PERSONALITY: {{personality}}
KEY MESSAGES: {{messages}}
GOAL: {{goal}}
DIRECTION: {{direction}}`;

function countWords(str) {
  return (str || '').trim().split(/\s+/).filter(Boolean).length;
}

function truncateToWordCap(text, max) {
  const words = (text || '').trim().split(/\s+/).filter(Boolean);
  return words.length > max ? words.slice(0, max).join(' ') : text;
}

export function buildCopyPrompt(brand, concept, spec) {
  const platform = PLATFORMS.find(p => p.id === spec.platform) || PLATFORMS[0];
  const copy = platform.copy || {};
  const hm = copy.headlineMaxWords ?? 8;
  const bm = copy.bodyMaxWords ?? 40;
  const cm = copy.ctaMaxWords ?? 3;
  const tone = copy.tone || 'brand-aligned';
  const title = concept.title || concept.headline || 'this campaign';
  const keyMessage = concept.key_message || concept.body || '';

  return `Write on-brand copy for a ${platform.label} post. Concept: "${title}" — ${keyMessage}. Platform constraints: headline ≤ ${hm} words, body ≤ ${bm} words, CTA ≤ ${cm} words. Tone: ${tone}. Return STRICT JSON: {"headline":"...","body":"...","cta":"..."}`;
}

export function buildImagePrompt(brand, concept, spec, headline, opts = {}) {
  const platform = PLATFORMS.find(p => p.id === spec.platform) || PLATFORMS[0];
  const copy = platform.copy || {};
  let prompt = concept.visual_direction || concept.visual_prompt || '';

  if (opts.noText) {
    prompt += ', clean background, no text overlay, no watermark';
  }

  prompt += `, ${platform.label} format, aspect ratio ${platform.aspect}, brand-aligned, high resolution, commercial quality`;
  if (headline) {
    prompt += `. Headline context: "${headline}"`;
  }
  return prompt;
}

export async function generateCampaignConcepts(brand, goal, direction = '') {
  const prompt = CAMPAIGN_PROMPT
    .replace('{{brandName}}', brand.brandName || 'Unknown')
    .replace('{{industry}}', brand.industry || 'General')
    .replace('{{tagline}}', brand.tagline || '')
    .replace('{{tone}}', (brand.toneOfVoice || []).join(', ') || 'modern')
    .replace('{{personality}}', (brand.brandPersonality || []).join(', ') || 'clean')
    .replace('{{messages}}', (brand.keyMessages || []).join('; ') || 'quality, innovation')
    .replace('{{goal}}', goal)
    .replace('{{direction}}', direction || 'open');

  const raw = await muapi.text(prompt);
  const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || raw);

  return (parsed.concepts || []).map(c => ({
    title: c.title || c.headline || '',
    theme: c.theme || '',
    key_message: c.key_message || c.body || '',
    hook: c.hook || '',
    cta: c.cta || '',
    recommended_platforms: Array.isArray(c.recommended_platforms) ? c.recommended_platforms : [],
    tone_notes: c.tone_notes || '',
    visual_direction: c.visual_direction || c.visual_prompt || '',
    headline: c.headline || c.title || '',
    body: c.body || c.key_message || '',
    rationale: c.rationale || c.tone_notes || '',
  }));
}

export async function generateAssetForConcept(brand, concept, platform, opts = {}) {
  const platformMeta = PLATFORMS.find(p => p.id === platform) || PLATFORMS[0];
  const copyConstraints = platformMeta.copy || {};

  const copyPrompt = buildCopyPrompt(brand, concept, { platform });
  const copyRaw = await muapi.text(copyPrompt);
  const copyJson = JSON.parse(copyRaw.match(/\{[\s\S]*\}/)?.[0] || copyRaw);

  if (copyJson.headline) copyJson.headline = truncateToWordCap(copyJson.headline, copyConstraints.headlineMaxWords ?? 999);
  if (copyJson.body) copyJson.body = truncateToWordCap(copyJson.body, copyConstraints.bodyMaxWords ?? 9999);
  if (copyJson.cta) copyJson.cta = truncateToWordCap(copyJson.cta, copyConstraints.ctaMaxWords ?? 999);

  const imagePrompt = buildImagePrompt(brand, concept, { platform }, copyJson.headline, { noText: true });

  const imagesList = [imagePrompt];
  if (brand.logoUrl) imagesList.push(brand.logoUrl);

  const imageUrl = await muapi.imageEdit2(imagePrompt, imagesList, {
    aspectRatio: platformMeta.aspect,
    resolution: opts.resolution || '2k',
    outputFormat: 'png',
  });

  return {
    id: generateId(),
    campaignId: null,
    platform: platformMeta.id,
    format: platformMeta.label,
    imageUrl: imageUrl || '',
    headline: copyJson.headline || '',
    body: copyJson.body || '',
    cta: copyJson.cta || '',
    variants: null,
    createdAt: new Date().toISOString(),
  };
}
