// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';

import { editorConfig } from '../editor/config.jsx';
import { EDITABLE_TEMPLATES } from '../editor/designs.js';
import { sanitizeEditorData } from '../templates.js';
import { collectTexts, applyChanges, checkRewrite } from '../rewrite.js';
import { sampleSections } from '../sampleContent.js';

// The industry designs added in the "20 new designs" batch: pc-* (one screen) and pd-* (full page).
const NEW = EDITABLE_TEMPLATES.filter((t) => /^editable-p[cd]-/.test(t.id));

/** Every prop on a component (and on every item of every list prop, and every nested slot item) must have an editor field. */
function missingFields(item, path = '') {
  const def = editorConfig.components[item.type];
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
    expect(NEW.filter((t) => t.id.startsWith('editable-pc-')).length).toBe(29);
    expect(NEW.filter((t) => t.id.startsWith('editable-pd-')).length).toBe(13);
  });

  NEW.forEach((t) => {
    describe(t.id, () => {
      it('every prop and list item has an editor field', () => {
        const missing = t.editorData.content.flatMap((c, i) => missingFields(c, `#${i} `));
        expect(missing).toEqual([]);
      });

      it('every section type is in the editor (can be added, moved and removed)', () => {
        const known = Object.keys(editorConfig.components);
        t.editorData.content.forEach((c) => expect(known).toContain(c.type));
      });

      it('the AI rewrite reaches the headline, benefits, form text, quotes and banner copy', () => {
        const texts = collectTexts(t.editorData).map((x) => x.text);
        const has = (s) => texts.some((x) => x.includes(String(s).replace(/\[\[|\]\]/g, '').split('\n')[0].slice(0, 25)));
        const hero = t.editorData.content.find((c) => c.type === 'Hero').props;
        expect(has(hero.headline)).toBe(true);
        expect(has(hero.subhead)).toBe(true);
        const strip = t.editorData.content.find((c) => c.type === 'Strip').props;
        strip.items.forEach((it) => { expect(has(it.title)).toBe(true); if (it.text) expect(has(it.text)).toBe(true); });
        const band = t.editorData.content.find((c) => c.type === 'ContactBand').props;
        expect(has(band.title)).toBe(true);
        const grid = t.editorData.content.find((c) => c.type === 'Grid' && c.props.items.some((i) => i.type === 'QuoteCard')).props.items;
        grid.forEach((g) => g.props.quotes.forEach((q) => { expect(has(q.text)).toBe(true); expect(has(q.name)).toBe(true); }));
        const cta = t.editorData.content.filter((c) => c.type === 'CtaBar' || (c.type === 'Showcase' && c.props.variant === 'band'));
        expect(cta.length).toBe(1);
        expect(has(cta[0].props.title || cta[0].props.label)).toBe(true);
        // never the structural bits
        expect(texts.some((x) => /^\/landing-art\//.test(x) || /^editable-/.test(x))).toBe(false);
      });

      it('a rewrite round-trip keeps structure, tokens and highlight markers', () => {
        const items = collectTexts(t.editorData);
        // a pretend AI answer: the same copy with a word appended (tokens, [[markers]] and line breaks untouched)
        const answered = items.map((x) => ({ ...x, after: `${x.text} now` })).filter((x) => checkRewrite(x.text, x.after));
        expect(answered.length).toBe(items.length); // every piece of copy is accepted by the safety check
        const next = applyChanges(t.editorData, answered);
        expect(next.content.map((c) => c.type)).toEqual(t.editorData.content.map((c) => c.type));
        // undo the appended word: the page is exactly the original, so nothing but words was touched
        const restored = JSON.parse(JSON.stringify(next, (k, v) => (typeof v === 'string' && v.endsWith(' now') ? v.slice(0, -4) : v)));
        expect(JSON.stringify(restored)).toBe(JSON.stringify(t.editorData));
        // and the tokens survive in the rewritten page
        expect((JSON.stringify(next).match(/\{\{[a-z0-9|\s']+\}\}/gi) || []).length).toBe((JSON.stringify(t.editorData).match(/\{\{[a-z0-9|\s']+\}\}/gi) || []).length);
      });

      it('survives sanitizeEditorData unchanged (nothing editable is dropped)', () => {
        const clean = sanitizeEditorData(t.editorData);
        expect(clean).toBeTruthy();
        expect(JSON.stringify(clean.content)).toBe(JSON.stringify(t.editorData.content));
      });

      it('the testimonial section is flagged as sample content before publishing', () => {
        expect(sampleSections(t.editorData, t.editorData, t.sampleTypes || []).length).toBeGreaterThan(0);
      });
    });
  });
});
