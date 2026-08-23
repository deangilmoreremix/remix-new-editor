/**
 * Shared utilities for repo manifest generators.
 *
 * Used by:
 *   scripts/generate-beatapi-minimaxh3.mjs
 *   scripts/generate-beatapi-seedance25.mjs
 *   scripts/generate-zeroLu-seedance.mjs
 */

import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/* ----------------------------------------------------- English detection */

/**
 * Returns true if the text is predominantly English (≥70% ASCII characters).
 * Entries below this threshold are considered non-English and skipped.
 */
export function isMostlyEnglish(text) {
  if (!text || typeof text !== 'string') return false;
  const ascii = text.replace(/[^\x00-\x7F]/g, '');
  return ascii.length / text.length >= 0.7;
}

/**
 * Returns true if the text contains any CJK characters.
 */
export function hasCJK(text) {
  return /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/.test(text || '');
}

/* ----------------------------------------------------- Auto-titling */

/**
 * Determines if an upstream title.en is usable as-is for the showcase.
 *
 * Rejects titles that are:
 * - Too short (< 8 chars)
 * - Containing CJK characters
 * - Just the slug reformatted
 * - Ending with a 5+ digit numeric ID from the slug
 * - Starting with generic noise phrases
 */
export function isUsableTitle(title, slug) {
  if (!title) return false;
  let t = title.trim();
  if (t.length < 12) return false;
  if (hasCJK(t)) return false;
  // Strip trailing numeric ID from slug
  t = t.replace(/\s*[\dX]{5,}$/, '').trim();
  if (t.length < 8) return false;
  // Check if title is just the slug
  const slugClean = slug.replace(/^[\dX]+(?:-|$)/, '').replace(/[-\d]+$/g, '').replace(/-/g, ' ').trim();
  if (t.toLowerCase().replace(/[']/g, '') === slugClean.toLowerCase()) return false;
  // Check for generic/noise phrases
  const noise = [
    'this video was', 'this video is', 'made with seedance', 'seedance 2.5',
    'minimax 3 prompt', 'image model', 'creative video', 'video prompt case',
    'audio15', 'how to push', 'it came out pretty', 'impressionante',
    'duration:', 'aspect ratio:', 'gen time:', 'total gen',
  ];
  const lower = t.toLowerCase();
  if (noise.some((n) => lower.includes(n))) return false;
  // Must have at least some alphabetic characters
  if (!/[a-zA-Z]/.test(t)) return false;
  return true;
}

/**
 * Generates a compact slug from a title string.
 */
export function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|]+$/g, '')
    .replace(/^-+/, '');
}

/**
 * Extracts a readable English title from prompt content.
 * Used when the upstream title.en is not usable.
 *
 * Strategy:
 *   1. Look for "Style:" prefix — extract the style description
 *   2. Look for "Create a/an X ..." — extract the object
 *   3. Parse structured prompts: skip format headers, find creative concept
 *   4. Take first substantial English sentence (skip timestamps, labels)
 *   5. Fallback: slug-word title-casing
 */
export function titleFromPrompt(prompt, category, slug) {
  const promptClean = (prompt || '').replace(/\s+/g, ' ').trim();

  // Pattern 1: "Style: X"
  {
    const m = promptClean.match(/Style:\s*(.+?)(?:\n\n|$)/i);
    if (m) {
      const t = m[1].split(/[,.;]/)[0].split('—')[0].trim();
      if (t && !hasCJK(t) && t.length > 8 && t.length < 80) return t;
    }
  }

  // Pattern 2: "Create a/an X ..."
  {
    const m = promptClean.match(/Create\s+(?:a\s+|an\s+)?(.+?)(?:\n\n|\.\s|$)/i);
    if (m) {
      const t = m[1].split(/[,.;]/)[0].trim();
      if (t && !hasCJK(t) && t.length > 10 && isMostlyEnglish(t)) return t.slice(0, 80);
    }
  }

  // Pattern 3: Skip format/structure headers, find first creative content line
  const skipPrefixes = [
    'duration:', 'aspect ratio:', 'format:', 'style:', 'global parameters:',
    'character:', 'camera style:', 'camera:', 'audio:', 'color palette:',
    'visual:', 'shot ', 'gen time:', 'total gen', 'model:', 'resolution:',
    'fps:', 'prompt visibility:', 'output status:', 'prompt source:',
    'model evidence', '[format]', '[1]', '[2]', '[3]', '[0-', 'broadcast type',
  ];

  const lines = (prompt || '').split('\n');
  for (const line of lines) {
    const trimmed = line.trim().replace(/^[#*\s]*[#*\s\[\]【】→-]/, '').trim();
    if (!trimmed || trimmed.length < 15) continue;
    const lower = trimmed.toLowerCase().replace(/\s+/g, ' ');
    if (skipPrefixes.some((p) => lower.startsWith(p))) continue;
    if (/^[\d\-\.:\s\[\]【】、，。；：]+$/.test(trimmed)) continue; // just numbers/timestamps
    if (!isMostlyEnglish(trimmed)) continue;
    // Clean and return
    const clean = trimmed
      .split(/[。.]/)[0]
      .split('|')[0]
      .replace(/^[#*\s\-→【】\[\]]+/, '')
      .trim();
    if (clean.length > 15 && clean.length < 80) return clean;
    if (clean.length >= 80) return clean.slice(0, 80).trim();
  }

  // Pattern 4: Fallback — derive from slug
  const str = String(slug || '').replace(/^[\dX]+(?:-|$)/, '').replace(/[-\d]+$/g, '').replace(/-/g, ' ');
  const slugWords = str
    .split(' ')
    .filter((w) => w.length > 2)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1));
  if (slugWords.length >= 6) return slugWords.slice(0, 4).join(' ');

  return category ? `${category.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase())} Concept` : 'Video Concept';
}

/**
 * Main auto-titling function.
 * Given a raw entry from a repo, returns a display-ready English title.
 */
export function autoTitle(slug, titleEn, prompt, category) {
  if (isUsableTitle(titleEn, slug)) {
    return titleEn.replace(/\s*[\dX]{5,}$/, '').trim();
  }
  return titleFromPrompt(prompt, category, slug);
}

/* ----------------------------------------------------- Duration parsing */

/**
 * Parses duration strings like "30s", "15s", "5s" into integer seconds.
 * Returns undefined if not parseable.
 */
export function parseDuration(value) {
  if (typeof value === 'number') return Math.round(value);
  if (typeof value !== 'string') return undefined;
  const m = value.match(/([\d.]+)/);
  return m ? Math.round(Number(m[1])) : undefined;
}

/* ----------------------------------------------------- Category mapping */

/**
 * Standard 12-label category vocabulary used across all showcase sections.
 */
export const SHOWCASE_CATEGORIES = [
  'All',
  'Action',
  'Animation',
  'Beauty',
  'Characters',
  'Cinema',
  'Commercial',
  'Fashion',
  'Food',
  'Social',
  'UGC',
  'VFX',
  'Web / UI',
];

/**
 * Mapping from the existing seedanceDemos.js 9-label system to MiniMax 12-label.
 * Used as a reference for how the existing Anil-matcha data was categorized.
 */
export const EXISTING_SEEDANCE_CATEGORIES = [
  'Cinematic',
  'Commercial',
  'Cultural',
  'Fashion',
  'Nature',
  'Product',
  'Sci-Fi',
  'VFX',
  'Animation',
];

/* ----------------------------------------------------- CTA routing */

/**
 * Route mapping for the "Create This Style" CTA.
 * These match the router keys in src/lib/router.js.
 */
export const CATEGORY_ROUTES = {
  Action: 'cinema',
  Animation: 'cinema',
  Beauty: 'influencer',
  Characters: 'character',
  Cinema: 'cinema',
  Commercial: 'commercial',
  Fashion: 'influencer',
  Food: 'commercial',
  Social: 'video',
  UGC: 'video',
  VFX: 'ai-vfx',
  'Web / UI': 'video',
};

export const DEFAULT_CREATE_ROUTE = 'video';

/* ----------------------------------------------------- File utilities */

export function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

export function writeJSON(path, data) {
  ensureDir(join(path, '..'));
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

export function writeJS(path, content) {
  ensureDir(join(path, '..'));
  writeFileSync(path, content, 'utf8');
}
