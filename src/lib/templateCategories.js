// Industry ("niche") templates are tagged two ways in the data: the proper label ("Dental Office")
// and a lowercase slug ("dental"). Both mean the same industry, so everything that groups, filters or
// counts templates by industry goes through nicheLabel() and sees one name per industry.
import { NICHE_LABELS_MAP } from './nicheTemplatesIndex.js';

const LABELS = Object.values(NICHE_LABELS_MAP || {});

/** "dental" / "real-estate" / "luxury-brand" / "Dental Office" -> "Dental Office". Unknown values pass through. */
export function nicheLabel(niche) {
  if (!niche) return '';
  const text = String(niche);
  if (LABELS.includes(text)) return text;
  const key = text.trim().toUpperCase().replace(/[\s-]+/g, '_');
  return NICHE_LABELS_MAP[key] || NICHE_LABELS_MAP[key.replace(/_BRAND$/, '')] || text;
}

/** The templates of one industry, whichever way they are tagged. */
export const templatesForNiche = (list, label) => list.filter((t) => t.niche && nicheLabel(t.niche) === label);
