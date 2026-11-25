#!/usr/bin/env node
// Checks every narration script against the guide data.
//   node scripts/guide-videos/validate-narration.mjs [slug ...]
// Exit code 1 on any error. Warnings (long/short lines) do not fail.
import { loadGuides, loadNarration, wordCount } from './lib.mjs';

const LIMITS = { intro: [12, 40], feature: [14, 38], outro: [8, 35], minFeatures: 4, maxFeatures: 10, maxTotalWords: 330 };
const guides = loadGuides();
const only = process.argv.slice(2);
let errors = 0; let warns = 0;
const err = (s, m) => { errors++; console.log(`ERROR ${s}: ${m}`); };
const warn = (s, m) => { warns++; console.log(`warn  ${s}: ${m}`); };

for (const g of guides.filter((x) => !only.length || only.includes(x.slug))) {
  const n = loadNarration(g.slug);
  if (!n) { err(g.slug, 'no narration file'); continue; }
  if (n.slug !== g.slug) err(g.slug, `slug field is "${n.slug}"`);
  const ids = new Set(g.features.map((f) => f.id));
  const lines = [['intro', n.intro, LIMITS.intro], ['outro', n.outro, LIMITS.outro]];
  const fe = Object.entries(n.features || {});
  if (fe.length < Math.min(LIMITS.minFeatures, g.features.length) || fe.length > LIMITS.maxFeatures) err(g.slug, `${fe.length} feature lines (need ${Math.min(LIMITS.minFeatures, g.features.length)}-${LIMITS.maxFeatures})`);
  for (const [id, text] of fe) {
    if (!ids.has(id)) err(g.slug, `unknown feature id "${id}"`);
    lines.push([id, text, LIMITS.feature]);
  }
  let total = 0;
  for (const [k, text, [lo, hi]] of lines) {
    if (typeof text !== 'string' || !text.trim()) { err(g.slug, `${k} is empty`); continue; }
    const w = wordCount(text); total += w;
    if (w > hi + 8) err(g.slug, `${k} is ${w} words (max ${hi})`);
    else if (w > hi || w < lo) warn(g.slug, `${k} is ${w} words (aim ${lo}-${hi})`);
    if (/[*_`#<>]|https?:|\.(com|app)\b|[\u{1F300}-\u{1FAFF}]/u.test(text)) err(g.slug, `${k} has markup, a URL or an emoji`);
    if (/\$\s?\d|\bcredits?\b.*\d|\d+\s?%/.test(text)) warn(g.slug, `${k} quotes a price or percentage, check it against the guide`);
  }
  if (total > LIMITS.maxTotalWords) warn(g.slug, `${total} words in total (about ${Math.round(total / 2.5)}s), aim for under ${LIMITS.maxTotalWords}`);
}
console.log(`\n${errors} errors, ${warns} warnings`);
process.exit(errors ? 1 : 0);
