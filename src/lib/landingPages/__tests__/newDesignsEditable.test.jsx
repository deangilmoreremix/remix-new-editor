// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';

import { puckConfig } from '../puck/config.jsx';
import { PUCK_TEMPLATES } from '../puck/designs.js';
import { sanitizePuck } from '../templates.js';
import { collectTexts, applyChanges, checkRewrite } from '../rewrite.js';
import { sampleSections } from '../sampleContent.js';

// The industry designs added in the "20 new designs" batch: pc-* (one screen) and pd-* (full page).
const NEW = PUCK_TEMPLATES.filter((t) => /^puck-p[cd]-/.test(t.id));

/** Every prop on a component (and on every item of every list prop, and every nested slot item) must have an editor field. */
function missingFields(item, path = '') {
  const def = puckConfig.components[item.type];
  if (!def) return [`${path}${item.type}: unknown component`];
  const out = [];
  Object.entries(item.props || {}).forEach(([k, v]) => {
    if (k === 'id') return;
    const field = def.fields?.[k];
    if (!field) { out.push(`${path}${item.type}.${k}: no editor field`); return; }
    if (field.type === 'slot' && Array.isArray(v)) v.forEach((child, i) => out.push(...missingFields(child, `${path}${item.type}.${k}[${i}] > `)));
    if (field.type === 'array' && Array.isArray(v) && field.arrayFields) {
      v.forEach((row, i) => Object.keys(row || {}).forEach((rk) => { if (!field.arrayFields[rk]) out.push(`${path}${item.type}.${k}[${i}].${rk}: no editor field`); }));
    }
  });
  return out;
}

describe('the 42 new industry designs are fully editable', () => {
  it('there are 42 of them (29 one-screen pc-* + 13 full-page pd-*)', () => {
    expect(NEW.filter((t) => t.id.startsWith('puck-pc-')).length).toBe(29);
    expect(NEW.filter((t) => t.id.startsWith('puck-pd-')).length).toBe(13);
  });

  NEW.forEach((t) => {
    describe(t.id, () => {
      it('every prop and list item has an editor field', () => {
        const missing = t.puckData.content.flatMap((c, i) => missingFields(c, `#${i} `));
        expect(missing).toEqual([]);
      });

      it('every section type is in the editor (can be added, moved and removed)', () => {
        const known = Object.keys(puckConfig.components);
        t.puckData.content.forEach((c) => expect(known).toContain(c.type));
      });

      it('the AI rewrite reaches the headline, benefits, form text, quotes and banner copy', () => {
        const texts = collectTexts(t.puckData).map((x) => x.text);
        const has = (s) => texts.some((x) => x.includes(String(s).replace(/\[\[|\]\]/g, '').split('\n')[0].slice(0, 25)));
        const hero = t.puckData.content.find((c) => c.type === 'Hero').props;
        expect(has(hero.headline)).toBe(true);
        expect(has(hero.subhead)).toBe(true);
        const strip = t.puckData.content.find((c) => c.type === 'Strip').props;
        strip.items.forEach((it) => { expect(has(it.title)).toBe(true); if (it.text) expect(has(it.text)).toBe(true); });
        const band = t.puckData.content.find((c) => c.type === 'ContactBand').props;
        expect(has(band.title)).toBe(true);
        const grid = t.puckData.content.find((c) => c.type === 'Grid' && c.props.items.some((i) => i.type === 'QuoteCard')).props.items;
        grid.forEach((g) => g.props.quotes.forEach((q) => { expect(has(q.text)).toBe(true); expect(has(q.name)).toBe(true); }));
        const cta = t.puckData.content.filter((c) => c.type === 'CtaBar' || (c.type === 'Showcase' && c.props.variant === 'band'));
        expect(cta.length).toBe(1);
        expect(has(cta[0].props.title || cta[0].props.label)).toBe(true);
        // never the structural bits
        expect(texts.some((x) => /^\/landing-art\//.test(x) || /^puck-/.test(x))).toBe(false);
      });

      it('a rewrite round-trip keeps structure, tokens and highlight markers', () => {
        const items = collectTexts(t.puckData);
        // a pretend AI answer: the same copy with a word appended (tokens, [[markers]] and line breaks untouched)
        const answered = items.map((x) => ({ ...x, after: `${x.text} now` })).filter((x) => checkRewrite(x.text, x.after));
        expect(answered.length).toBe(items.length); // every piece of copy is accepted by the safety check
        const next = applyChanges(t.puckData, answered);
        expect(next.content.map((c) => c.type)).toEqual(t.puckData.content.map((c) => c.type));
        // undo the appended word: the page is exactly the original, so nothing but words was touched
        const restored = JSON.parse(JSON.stringify(next, (k, v) => (typeof v === 'string' && v.endsWith(' now') ? v.slice(0, -4) : v)));
        expect(JSON.stringify(restored)).toBe(JSON.stringify(t.puckData));
        // and the tokens survive in the rewritten page
        expect((JSON.stringify(next).match(/\{\{[a-z0-9|\s']+\}\}/gi) || []).length).toBe((JSON.stringify(t.puckData).match(/\{\{[a-z0-9|\s']+\}\}/gi) || []).length);
      });

      it('survives sanitizePuck unchanged (nothing editable is dropped)', () => {
        const clean = sanitizePuck(t.puckData);
        expect(clean).toBeTruthy();
        expect(JSON.stringify(clean.content)).toBe(JSON.stringify(t.puckData.content));
      });

      it('the testimonial section is flagged as sample content before publishing', () => {
        expect(sampleSections(t.puckData, t.puckData, t.sampleTypes || []).length).toBeGreaterThan(0);
      });
    });
  });
});
