import { describe, it, expect } from 'vitest';
import { ALL_NICHE_TEMPLATES } from '../lib/nicheTemplatesIndex.js';
import { NICHE_SCRIPTS, templateScript, fillPlaceholders, placeholdersLeft, DETAIL_FIELDS } from '../lib/nicheScripts/index.js';
import { normalizeSceneLines } from '../lib/editor/scriptAiService.js';
import { scriptLines } from '../components/modals/template-generator/rules.js';

const durationOf = (t) => (typeof t.duration === 'string' ? JSON.parse(t.duration) : t.duration).default;
const words = (s) => s.trim().split(/\s+/).length;

describe('written scripts for all 120 niche templates', () => {
  it('every template has one, and nothing else is in the library', () => {
    expect(ALL_NICHE_TEMPLATES.length).toBe(120);
    const missing = ALL_NICHE_TEMPLATES.filter((t) => !NICHE_SCRIPTS[t.id]).map((t) => t.id);
    expect(missing).toEqual([]);
    expect(Object.keys(NICHE_SCRIPTS).filter((id) => !ALL_NICHE_TEMPLATES.some((t) => t.id === id))).toEqual([]);
  });

  it('has exactly one line per scene, in the template\'s own scene order, plus a call to action', () => {
    for (const t of ALL_NICHE_TEMPLATES) {
      const s = NICHE_SCRIPTS[t.id];
      expect(s.lines.length, `${t.id} lines vs scenes (${t.sceneStructure.join(' / ')})`).toBe(t.sceneStructure.length);
      for (const l of s.lines) expect(l.trim().length, `${t.id} has an empty line`).toBeGreaterThan(3);
      expect(s.cta.trim().length, `${t.id} cta`).toBeGreaterThan(8);
    }
  });

  it('fits the video length (about 1–2.9 spoken words per second)', () => {
    for (const t of ALL_NICHE_TEMPLATES) {
      const w = words(NICHE_SCRIPTS[t.id].lines.join(' '));
      const d = durationOf(t);
      expect(w, `${t.id}: ${w} words for ${d}s`).toBeGreaterThanOrEqual(Math.floor(d * 1.0));
      expect(w, `${t.id}: ${w} words for ${d}s`).toBeLessThanOrEqual(Math.ceil(d * 2.9));
    }
  });

  it('uses only the three fill-ins, with no stray braces, brackets or leftovers', () => {
    for (const [id, s] of Object.entries(NICHE_SCRIPTS)) {
      for (const l of [...s.lines, s.cta]) {
        const tokens = l.match(/\{[^}]*\}/g) || [];
        for (const tk of tokens) expect(['{business_name}', '{city}', '{offer}'], `${id}: ${tk}`).toContain(tk);
        expect(l, `${id}`).not.toMatch(/[\[\]]|TODO|lorem|xxx/i);
      }
    }
  });

  it('every line is unique within its script, and no two templates share a line', () => {
    const seen = new Map();
    for (const [id, s] of Object.entries(NICHE_SCRIPTS)) {
      expect(new Set(s.lines).size, `${id} repeats a line`).toBe(s.lines.length);
      for (const l of s.lines) { if (l.length > 30) { expect(seen.has(l), `${id} duplicates ${seen.get(l)}`).toBe(false); seen.set(l, id); } }
    }
  });

  it('makes no guarantees or cure claims (negated disclaimers are fine)', () => {
    const risky = /\b(cure[sd]?|100%|painless|pain-free|guarantee[sd]?|risk-free|#1|best in|number one|award-winning|permanent(ly)?|miracle|instant results?|lowest price|clinically proven)\b/i;
    const allowed = /not guaranteed|do not guarantee|nothing here guarantees|did not ask for a miracle/i;
    for (const [id, s] of Object.entries(NICHE_SCRIPTS)) for (const l of [...s.lines, s.cta]) if (risky.test(l)) expect(allowed.test(l), `${id}: ${l}`).toBe(true);
  });

  it('legal, dental, med-spa and wellness scripts carry no outcome promises', () => {
    const sensitive = ALL_NICHE_TEMPLATES.filter((t) => /Legal|Dental|Med Spa|Chiropractic/.test(t.niche));
    expect(sensitive.length).toBe(40);
    for (const t of sensitive) for (const l of NICHE_SCRIPTS[t.id].lines) expect(l, t.id).not.toMatch(/\b(will (cure|fix|heal)|you will (win|recover|be pain)|we (always|never) (win|lose))\b/i);
  });
});

describe('filling in the user\'s details', () => {
  it('replaces {business_name}, {city} and {offer}', () => {
    const s = templateScript('midnight_table_film', { business_name: 'Luna Bistro', city: 'Austin' });
    expect(s.lines).toHaveLength(5);
    expect(s.text.split('\n')).toEqual(s.lines);
    expect(s.text).toContain('Austin');
    expect(s.text + s.cta).toContain('Luna Bistro');
    expect(s.text + s.cta).not.toMatch(/\{/);
    expect(templateScript('last_call_promo', { offer: '2-for-1 cocktails until 9pm' }).text).toContain('2-for-1 cocktails until 9pm');
  });
  it('shows a visible reminder for anything left empty', () => {
    const s = templateScript('last_call_promo', {});
    const left = placeholdersLeft(s.text + ' ' + s.cta);
    expect(left).toEqual(expect.arrayContaining(['[Your offer]']));
    expect(fillPlaceholders('{city}', { city: '  ' })).toBe('[Your city]');
    expect(DETAIL_FIELDS.map((f) => f.key)).toEqual(['business_name', 'city', 'offer']);
    expect(placeholdersLeft(templateScript('midnight_table_film', { business_name: 'A', city: 'B' }).text)).toEqual([]);
  });
  it('unknown template → null', () => expect(templateScript('nope')).toBeNull());
});

describe('captions follow the script\'s own lines', () => {
  it('a one-line-per-scene script keeps its lines; plain prose still splits into sentences', () => {
    expect(scriptLines('Line one here. Still line one.\nLine two.\nLine three.', 3)).toEqual(['Line one here. Still line one.', 'Line two.', 'Line three.']);
    expect(scriptLines('One. Two. Three. Four.', 2)).toEqual(['One. Two.', 'Three. Four.']);
    expect(scriptLines('a\nb\nc\nd', 2)).toEqual(['a b', 'c d']);
  });
});

describe('normalizeSceneLines (cleaning an AI answer to one line per scene)', () => {
  it('strips numbering, scene labels, bullets and quotes', () => {
    expect(normalizeSceneLines('Scene 1: "Hello there."\n2. Second.\n- Third\n\n• Fourth', 4)).toEqual(['Hello there.', 'Second.', 'Third', 'Fourth']);
  });
  it('merges extra lines into the last scene', () => expect(normalizeSceneLines('a\nb\nc\nd\ne', 3)).toEqual(['a', 'b', 'c d e']));
  it('splits a long multi-sentence line when there are too few lines', () => {
    expect(normalizeSceneLines('One. Two.\nThree. Four.', 4)).toEqual(['One.', 'Two.', 'Three.', 'Four.']);
  });
  it('leaves a short answer alone when it cannot be split further, and handles empty input', () => {
    expect(normalizeSceneLines('Just one', 3)).toEqual(['Just one']);
    expect(normalizeSceneLines('', 3)).toEqual([]);
  });
});
