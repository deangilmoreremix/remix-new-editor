/**
 * Written scripts for the 120 niche templates (12 industries × 10), one per template id.
 * Each has exactly one line per scene (same order as the template's `sceneStructure`) plus a call to action.
 * {business_name}, {city} and {offer} are filled from the "Your details" fields in the Template Generator;
 * anything still empty shows as a visible [Your business] / [Your city] / [Your offer] reminder.
 */
import { RESTAURANT_SCRIPTS } from './restaurant.js';
import { MED_SPA_SCRIPTS } from './medspa.js';
import { SALON_SCRIPTS } from './salon.js';
import { FITNESS_SCRIPTS } from './fitness.js';
import { REAL_ESTATE_SCRIPTS } from './realestate.js';
import { DENTAL_SCRIPTS } from './dental.js';
import { CHIROPRACTIC_SCRIPTS } from './chiropractic.js';
import { LEGAL_SCRIPTS } from './legal.js';
import { AUTOMOTIVE_SCRIPTS } from './automotive.js';
import { FASHION_SCRIPTS } from './fashion.js';
import { EVENT_SCRIPTS } from './events.js';
import { LUXURY_SCRIPTS } from './luxury.js';

export const NICHE_SCRIPTS = Object.freeze({
  ...RESTAURANT_SCRIPTS, ...MED_SPA_SCRIPTS, ...SALON_SCRIPTS, ...FITNESS_SCRIPTS, ...REAL_ESTATE_SCRIPTS, ...DENTAL_SCRIPTS,
  ...CHIROPRACTIC_SCRIPTS, ...LEGAL_SCRIPTS, ...AUTOMOTIVE_SCRIPTS, ...FASHION_SCRIPTS, ...EVENT_SCRIPTS, ...LUXURY_SCRIPTS,
});

/** The fill-in fields, in the order they are shown. */
export const DETAIL_FIELDS = Object.freeze([
  { key: 'business_name', label: 'Business name', placeholder: 'e.g. Luna Bistro', fallback: '[Your business]' },
  { key: 'city', label: 'City', placeholder: 'e.g. Austin', fallback: '[Your city]' },
  { key: 'offer', label: 'Offer (optional)', placeholder: 'e.g. 20% off your first visit', fallback: '[Your offer]' },
]);
const FALLBACK = Object.fromEntries(DETAIL_FIELDS.map((f) => [f.key, f.fallback]));

/** Replace {business_name} / {city} / {offer} with the user's details (or a visible reminder when empty). */
export const fillPlaceholders = (str, details = {}) => String(str ?? '').replace(/\{(business_name|city|offer)\}/g, (_, k) => String(details?.[k] ?? '').trim() || FALLBACK[k]);

/** [Your business] style reminders still in a text (so the UI can nudge the user to fill them). */
export const placeholdersLeft = (text) => [...new Set(String(text || '').match(/\[Your (?:business|city|offer)\]/g) || [])];

/** The written script for a template: { lines, text (one line per scene), cta } with details filled in; null when there is none. */
export function templateScript(id, details = {}) {
  const s = NICHE_SCRIPTS[id];
  if (!s) return null;
  const lines = s.lines.map((l) => fillPlaceholders(l, details));
  return { lines, text: lines.join('\n'), cta: fillPlaceholders(s.cta, details) };
}
