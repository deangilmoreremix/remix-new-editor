#!/usr/bin/env node
// Prints the source facts a narration writer needs for one studio guide.
//   node scripts/guide-videos/brief.mjs image-studio
import { loadGuides } from './lib.mjs';

const slug = process.argv[2];
const guides = loadGuides();
if (!slug) { console.log(guides.map((g) => `${g.slug}\t${g.name}\t${g.features.length} features`).join('\n')); process.exit(0); }
const g = guides.find((x) => x.slug === slug);
if (!g) { console.error(`unknown guide "${slug}"`); process.exit(1); }
const out = {
  slug: g.slug, name: g.name, category: g.category,
  shortDescription: g.shortDescription, description: g.description, bestFor: g.bestFor,
  keyFeatures: g.keyFeatures, tips: (g.tips || []).slice(0, 4),
  features: g.features.map((f) => ({ id: f.id, name: f.name, definition: f.definition, whyToUse: f.whyToUse, restrictions: f.restrictions })),
};
console.log(JSON.stringify(out, null, 1));
