// src/components/personalize/tokenSchema.js
//
// Single source of truth for personalization tokens.
//
// Why this module exists
// ----------------------
// The personalizer had a silent, total failure: `PersonalizeModal` rendered
// token chips keyed by *display label* and inserted `{{First Name}}`, while
// `replaceTokensInPrompt` only ever resolved *camelCase keys* (`{{firstName}}`)
// against `profile.variables`. Every chip was therefore unresolvable, via two
// independent failure modes:
//
//   1. Multi-word labels never even matched the token regex, because the old
//      pattern (`[a-zA-Z_][a-zA-Z0-9_]*`) rejects the space in `First Name`.
//   2. Single-word labels matched but looked up the wrong key — `{{Company}}`
//      resolved `vars['Company']`, while the stored key is `company`.
//
// The net effect was raw `{{First Name}}` text leaking straight into model
// prompts. This module fixes it at the root by defining the canonical key set
// once, together with every alias that should resolve to it, plus a fallback
// path into the nested profile so a token still resolves when `variables`
// wasn't fully populated.
//
// The canonical wire format is camelCase keys, matching what the backend
// writes in `netlify/functions/intelligence-api.js` (`buildVariables`). New
// prompts insert `{{firstName}}`; older prompts that already contain
// `{{First Name}}` keep working because labels are registered as aliases.

import { resolveSocialToken } from '../../lib/socialIdentity.js';

/**
 * Canonical token definitions.
 *
 * - `key`    — canonical camelCase token name (the wire format)
 * - `label`  — human-facing name shown on the chip
 * - `paths`  — ordered fallback lookups into the nested profile object,
 *              used when `profile.variables[key]` is absent/empty
 * - `aliases`— extra spellings that should resolve to this key
 */
export const TOKEN_DEFS = [
  { key: 'firstName', label: 'First Name', paths: ['contact.firstName'] },
  { key: 'lastName', label: 'Last Name', paths: ['contact.lastName'] },
  { key: 'fullName', label: 'Full Name', paths: ['contact.name'], aliases: ['name'] },
  { key: 'company', label: 'Company', paths: ['contact.company', 'company.name'] },
  { key: 'companyName', label: 'Company Name', paths: ['company.name', 'contact.company'] },
  { key: 'title', label: 'Title', paths: ['contact.title'], aliases: ['jobTitle', 'role'] },
  { key: 'email', label: 'Email', paths: ['contact.email'] },
  { key: 'location', label: 'Location', paths: ['contact.location'], aliases: ['city'] },
  { key: 'industry', label: 'Industry', paths: ['company.industry'] },
  { key: 'companySummary', label: 'Company Summary', paths: ['company.summary'] },
  { key: 'painPoint', label: 'Pain Point', paths: ['intelligence.painPoints.0'], aliases: ['pain', 'painPoints'] },
  { key: 'product', label: 'Product', paths: ['intelligence.products.0'], aliases: ['products'] },
  { key: 'service', label: 'Service', paths: ['intelligence.services.0'], aliases: ['services'] },
  { key: 'interest', label: 'Interest', paths: ['intelligence.interests.0'], aliases: ['interests'] },
  { key: 'buyingSignal', label: 'Buying Signal', paths: ['intelligence.buyingSignals.0'], aliases: ['buyingSignals'] },
  { key: 'tone', label: 'Tone', paths: ['intelligence.tone'] },
  {
    key: 'intelligenceSummary',
    label: 'Summary',
    paths: ['intelligence.summary'],
    aliases: ['summary'],
  },
  { key: 'brandColor', label: 'Brand Color', paths: ['brand.colors.primary'], aliases: ['primaryColor'] },
  { key: 'logoUrl', label: 'Logo', paths: ['assets.logos.0'], aliases: ['logo'] },
  {
    key: 'avatarUrl',
    label: 'Avatar',
    paths: ['assets.avatar.0', 'assets.avatars.0', 'contact.avatarUrl'],
    aliases: ['avatar'],
  },
  { key: 'github', label: 'GitHub', paths: ['social.github'] },
  { key: 'linkedin', label: 'LinkedIn', paths: ['social.linkedin'] },
  { key: 'twitter', label: 'X / Twitter', paths: ['social.twitter'], aliases: ['x'] },
  { key: 'website', label: 'Website', paths: ['social.website', 'website.url'], aliases: ['site', 'url'] },
];

/** Canonical key -> display label. Mirrors the old TOKEN_LABELS map. */
export const TOKEN_LABELS = TOKEN_DEFS.reduce((acc, def) => {
  acc[def.key] = def.label;
  return acc;
}, {});

/** Ordered list of canonical token keys. */
export const TOKEN_KEYS = TOKEN_DEFS.map((d) => d.key);

/**
 * Normalize a token name for tolerant matching: case-insensitive and
 * insensitive to spaces, underscores, hyphens, dots and slashes.
 *
 * `First Name` / `firstName` / `first_name` / `FIRST-NAME` -> `firstname`
 */
export function normalizeTokenName(name) {
  return String(name == null ? '' : name)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Lookup table: every accepted spelling (canonical key, label, alias) mapped
 * to its canonical key, under `normalizeTokenName` normalization.
 */
const ALIAS_TO_KEY = (() => {
  const map = new Map();
  for (const def of TOKEN_DEFS) {
    const spellings = [def.key, def.label, ...(def.aliases || [])];
    for (const spelling of spellings) {
      const norm = normalizeTokenName(spelling);
      // First registration wins so canonical keys are never shadowed by an
      // alias that another token also claims.
      if (norm && !map.has(norm)) map.set(norm, def.key);
    }
  }
  return map;
})();

/** Canonical key -> definition. */
const KEY_TO_DEF = TOKEN_DEFS.reduce((acc, def) => {
  acc[def.key] = def;
  return acc;
}, {});

/**
 * Resolve any accepted token spelling to its canonical camelCase key.
 * Returns null when the name is not a known token.
 */
export function canonicalTokenKey(name) {
  return ALIAS_TO_KEY.get(normalizeTokenName(name)) || null;
}

/** Read a dotted path (supporting numeric array indices) out of an object. */
function readPath(obj, path) {
  let cursor = obj;
  for (const segment of String(path).split('.')) {
    if (cursor == null) return undefined;
    cursor = cursor[segment];
  }
  return cursor;
}

/** A value counts as present only when it is a non-empty scalar. */
function isUsable(value) {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return true;
  return false;
}

/**
 * Resolve a single token against a profile.
 *
 * Resolution order:
 *   1. `profile.variables[canonicalKey]`
 *   2. `profile.variables[<any accepted spelling>]` (tolerates legacy maps
 *      that were keyed by label)
 *   3. the definition's fallback `paths` into the nested profile
 *
 * @param {object} profile
 * @param {string} rawName - token name as written by the user, e.g. "First Name"
 * @returns {string|null} the resolved value, or null when unresolvable
 */
export function resolveToken(profile, rawName) {
  if (!profile) return null;
  const key = canonicalTokenKey(rawName);
  const vars = profile.variables || {};

  // 1) Canonical key in the variables map.
  if (key && isUsable(vars[key])) return String(vars[key]);

  // 2) Any accepted spelling in the variables map (legacy label-keyed maps,
  //    or a raw key the schema doesn't know about).
  const wanted = normalizeTokenName(rawName);
  for (const [varKey, varValue] of Object.entries(vars)) {
    if (normalizeTokenName(varKey) === wanted && isUsable(varValue)) {
      return String(varValue);
    }
  }

  // 3) Fallback paths into the nested profile.
  if (key) {
    const def = KEY_TO_DEF[key];
    for (const path of def.paths || []) {
      const value = readPath(profile, path);
      if (isUsable(value)) return String(value);
    }
  }

  // 4) Dynamic social tokens: social.<platform>.username / .url
  //    These are not pre-registered in TOKEN_DEFS because platforms are
  //    discovered at runtime from Maigret / socialProfiles.
  const socialResolved = resolveSocialToken(profile, rawName);
  if (socialResolved !== null) return String(socialResolved);

  return null;
}

/**
 * Build the flat `variables` map for a profile, covering every canonical
 * token the profile can currently satisfy. Used when persisting a profile so
 * downstream consumers (studios, timeline, exports) see a complete map rather
 * than the 11 hand-picked fields the modal used to write.
 *
 * @param {object} profile
 * @param {object} [seed] - values that take precedence over derived ones
 * @returns {Record<string,string>}
 */
export function buildVariables(profile, seed = {}) {
  const variables = {};
  for (const key of TOKEN_KEYS) {
    if (isUsable(seed[key])) {
      variables[key] = String(seed[key]);
      continue;
    }
    const resolved = resolveToken(profile, key);
    if (resolved !== null) variables[key] = resolved;
  }
  return variables;
}

/**
 * Matches `{{ token }}` where the token may contain spaces, slashes, dots,
 * underscores and hyphens — deliberately broader than the old
 * identifier-only pattern so multi-word labels like `{{First Name}}` and
 * `{{X / Twitter}}` are matched instead of being silently skipped.
 *
 * Excludes `{` and `}` so adjacent/nested braces can't be swallowed.
 */
export const TOKEN_PATTERN = /\{\{\s*([^{}]+?)\s*\}\}/g;

/**
 * Extract the distinct token names present in a prompt, in order.
 * @returns {string[]}
 */
export function extractTokens(prompt) {
  if (!prompt) return [];
  const found = [];
  const seen = new Set();
  for (const match of String(prompt).matchAll(TOKEN_PATTERN)) {
    const raw = match[1].trim();
    if (!raw || seen.has(raw)) continue;
    seen.add(raw);
    found.push(raw);
  }
  return found;
}
