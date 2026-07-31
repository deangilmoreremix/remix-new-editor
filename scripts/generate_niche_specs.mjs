#!/usr/bin/env node
// Generates the nicheTemplateSpecs.js file with 120 niche template spec entries.
// Run from the project root:  node scripts/generate_niche_specs.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = process.env.NICHE_SPECS_OUT_DIR
  ? path.resolve(process.env.NICHE_SPECS_OUT_DIR)
  : path.resolve(__dirname, '..');
const srcLibDir = path.join(repoRoot, 'src/lib');

// Use a dynamic import with a file URL to honour the resolved srcLibDir
const indexUrl = pathToFileURL(path.join(srcLibDir, 'nicheTemplatesIndex.js')).href;
const { ALL_NICHE_TEMPLATES } = await import(indexUrl);

// Canonical niche key used for keyword composition
const NICHE_KEY = {
  'Restaurant & Cafe': 'restaurant',
  'Med Spa & Beauty': 'med-spa',
  'Salon & Barbershop': 'salon',
  'Gym & Fitness': 'fitness',
  'Real Estate': 'real-estate',
  'Dental Office': 'dental',
  'Chiropractic & Wellness': 'chiropractic',
  'Legal & Attorney': 'legal',
  'Automotive & Car': 'automotive',
  'Fashion & Style': 'fashion',
  'Events & Celebrations': 'event',
  'Luxury & Premium': 'luxury-brand',
};

const NICHE_HUMAN = {
  'Restaurant & Cafe': 'restaurant',
  'Med Spa & Beauty': 'med spa',
  'Salon & Barbershop': 'salon or barbershop',
  'Gym & Fitness': 'fitness',
  'Real Estate': 'real estate',
  'Dental Office': 'dental',
  'Chiropractic & Wellness': 'chiropractic or wellness',
  'Legal & Attorney': 'legal',
  'Automotive & Car': 'automotive',
  'Fashion & Style': 'fashion',
  'Events & Celebrations': 'event',
  'Luxury & Premium': 'luxury brand',
};

const STYLE_MAP = {
  'Cinematic Commercial': {
    key: 'cinematic-commercial',
    visual: 'Premium, polished, brand-forward, controlled lighting',
    cinema: 'Slow dolly or tracking movement, controlled lighting, clear subject focus, shallow depth of field',
    phrase: 'cinematic commercial style',
    sceneTone: 'conversion-aware and elegant',
  },
  'Documentary': {
    key: 'documentary',
    visual: 'Documentary realism, natural light, observational, grounded',
    cinema: 'Natural light feel, observational framing, subtle handheld or measured movement, authentic texture',
    phrase: 'documentary style',
    sceneTone: 'observational and grounded',
  },
  'Emotional Brand Story': {
    key: 'emotional-brand-story',
    visual: 'Filmic, emotional, premium textures, cinematic reveal',
    cinema: 'Filmic narrative, emotional progression, premium textures, cinematic reveal moments',
    phrase: 'emotional brand story',
    sceneTone: 'emotional and human',
  },
  'Bold Direct Response': {
    key: 'bold-direct-response',
    visual: 'Fast, persuasive, conversion-aware, punchy pacing',
    cinema: 'Fast social pacing, tight product close-ups, clean reveal shots, ad-style rhythm',
    phrase: 'bold direct response',
    sceneTone: 'urgent and high-conversion',
  },
  'Luxury Brand Promo': {
    key: 'luxury-brand-promo',
    visual: 'Premium, polished, brand-forward, controlled lighting',
    cinema: 'Slow dolly or tracking movement, controlled lighting, clear subject focus, premium atmosphere',
    phrase: 'luxury brand promo',
    sceneTone: 'elegant and aspirational',
  },
  'Dramatic Trailer': {
    key: 'dramatic-trailer',
    visual: 'High-impact, moody contrast, dramatic motion, big reveals',
    cinema: 'High-impact pacing, moody contrast, reveal shots, dramatic camera motion',
    phrase: 'dramatic trailer',
    sceneTone: 'high-impact and cinematic',
  },
  'Inspirational Founder': {
    key: 'inspirational-founder',
    visual: 'Portrait-led, emotional, authoritative, warm practical light',
    cinema: 'Portrait-led premium close-ups, emotional pacing, authority framing, warm practical light',
    phrase: 'inspirational founder story',
    sceneTone: 'portrait-led and grounded',
  },
  'Customer Transformation': {
    key: 'customer-transformation',
    visual: 'Filmic, emotional, premium textures, cinematic reveal',
    cinema: 'Filmic narrative, emotional progression, before/after reveal moments, premium textures',
    phrase: 'customer transformation',
    sceneTone: 'transformative and trust-building',
  },
  'Cinematic Social Short': {
    key: 'cinematic-social-short',
    visual: 'Trend-aware, cinematic-social, energetic, polished',
    cinema: 'Vertical-friendly framing, hook-first composition, dynamic close-ups, fast push-ins, punchy transitions',
    phrase: 'cinematic social short',
    sceneTone: 'scroll-stopping and shareable',
  },
};

const NICHE_ATMOSPHERE = {
  'Restaurant & Cafe': 'warm, sensory, and appetite-driven atmosphere',
  'Med Spa & Beauty': 'calming, soft-glow, premium spa atmosphere',
  'Salon & Barbershop': 'polished, characterful, in-shop atmosphere',
  'Gym & Fitness': 'high-energy, athletic, sweat-and-iron atmosphere',
  'Real Estate': 'lifestyle-led, architectural, bright interior atmosphere',
  'Dental Office': 'clean, clinical-yet-warm, reassuring atmosphere',
  'Chiropractic & Wellness': 'calming, restorative, balanced-body atmosphere',
  'Legal & Attorney': 'authoritative, trustworthy, boardroom-grade atmosphere',
  'Automotive & Car': 'chrome, motion, showroom-and-asphalt atmosphere',
  'Fashion & Style': 'editorial, high-fashion, runway-grade atmosphere',
  'Events & Celebrations': 'celebratory, lively, on-stage atmosphere',
  'Luxury & Premium': 'aspirational, refined, private-members-club atmosphere',
};

function specForTemplate(t) {
  const niche = t.niche;
  const nicheKey = NICHE_KEY[niche] || 'general';
  const nicheHuman = NICHE_HUMAN[niche] || nicheKey;
  const styleName = (t.outputStyle && t.outputStyle.name) || 'Cinematic Commercial';
  const style = STYLE_MAP[styleName] || STYLE_MAP['Cinematic Commercial'];
  const atmosphere = NICHE_ATMOSPHERE[niche] || 'premium, brand-forward atmosphere';

  const sceneBlueprint = Array.isArray(t.sceneStructure) && t.sceneStructure.length
    ? t.sceneStructure.slice(0, 6)
    : ['Hook', 'Brand intro', 'Hero detail', 'Human moment', 'CTA'];

  const name = t.name || t.id;
  const desc = (t.description || `${name} for ${nicheHuman} brands.`).trim().replace(/[.!?]+$/, '');

  const coreUseCase = `${name} (${styleName.toLowerCase()}) for ${niche} brands`;
  const uiDescription = `${desc}. Built for ${niche.toLowerCase()} brands seeking premium video.`;
  const promptGoal = `Create a ${style.phrase} ${nicheHuman} video that drives engagement and trust.`;

  const enhancerKeywords = [
    `${nicheKey} ${style.key}`,
    `premium ${nicheHuman} visuals`,
    `${style.sceneTone} ${nicheKey} composition`,
    `${nicheKey} ${style.key} brand atmosphere`,
    `${nicheKey} ${styleName.toLowerCase()} aesthetic`,
  ].join(', ');

  const negativePrompt = 'cheap look, cluttered frame, poor lighting, weak composition, amateur quality';
  const outputPackage = ['master prompt', 'scene prompts', `${nicheKey} reveal CTA`];

  return {
    coreUseCase,
    uiDescription,
    promptGoal,
    visualStyle: style.visual,
    sceneBlueprint,
    cinematography: style.cinema,
    enhancerKeywords,
    negativePrompt,
    outputPackage,
    niche,
    outputType: 'video',
    category: t.category || 'Industry Specific',
    atmosphere,
  };
}

const specs = {};
let count = 0;
for (const t of ALL_NICHE_TEMPLATES) {
  if (!t || !t.id) continue;
  specs[t.id] = specForTemplate(t);
  count++;
}

if (count !== 120) {
  console.error(`WARNING: expected 120 niche template specs, generated ${count}`);
}

const fileBody =
  `// Niche Template Specifications for ${count} industry-specific templates\n` +
  `// Auto-generated. Source: src/lib/nicheTemplatesIndex.js (ALL_NICHE_TEMPLATES)\n` +
  `// Spread into TEMPLATE_SPECS at load time via src/lib/templateSpecs.js\n\n` +
  `export const NICHE_TEMPLATE_SPECS = ${JSON.stringify(specs, null, 2)};\n\n` +
  `export default NICHE_TEMPLATE_SPECS;\n`;

const outPath = path.join(srcLibDir, 'nicheTemplateSpecs.js');
fs.writeFileSync(outPath, fileBody, 'utf8');
console.log(`Wrote ${count} niche template specs to ${outPath}`);
