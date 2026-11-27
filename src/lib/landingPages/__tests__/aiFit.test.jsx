// @vitest-environment jsdom
// AI-written content must land in its box looking like the design: casing, highlight marks, endings, placeholders.
import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => {
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  globalThis.matchMedia = globalThis.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
});
import { renderToString } from 'react-dom/server';
import { Render } from '@page-editor/core';
import { editorConfig } from '../editor/config.jsx';
import { PageContext } from '../editor/context.js';
import { EDITABLE_TEMPLATES } from '../editor/designs.js';
import { matchStyle, caseOf, collectTexts, proposeRewrite, fieldFormat, fitsFormat } from '../rewrite.js';

const page = { id: 'abc12345', title: 'Intro', video_url: '', poster_url: null };
const draw = (type, props) => renderToString(
  <PageContext.Provider value={{ page, tokens: { firstname: 'Ann' }, handlers: {}, preview: false }}>
    <Render config={editorConfig} data={{ root: { props: {} }, content: [{ type, props: { id: 'x', ...editorConfig.components[type].defaultProps, ...props } }] }} />
  </PageContext.Provider>,
);

describe('AI text in real components', () => {
  it('an ALL-CAPS eyebrow stays ALL CAPS on the page', () => {
    const current = editorConfig.components.LeadiqTestimonials.defaultProps.eyebrow;
    expect(current).toBe('CUSTOMER LOVE');
    expect(draw('LeadiqTestimonials', { eyebrow: matchStyle(current, 'Happy customers') })).toContain('HAPPY CUSTOMERS');
  });

  it('a headline written with highlight marks gets the accent style, with no raw brackets', () => {
    const fmt = fieldFormat('Headline (wrap words in [[double brackets]] to highlight)', '');
    const written = matchStyle('', 'Fix leaks [[fast]], Hi {{firstname|there}}');
    expect(fitsFormat(written, fmt, '')).toBe(true);
    const html = draw('Hero', { headline: written });
    expect(html).toContain('<span class="pk-accent">fast</span>');
    expect(html).toContain('Ann');
    expect(html).not.toContain('[[');
  });

  it('a Title Case button stays Title Case and keeps its ending', () => {
    const current = editorConfig.components.CtaBar.defaultProps.label;     // "Book a Free Consultation"
    const label = matchStyle(current, 'call us today.');
    expect(label).toBe('Call Us Today');
    expect(draw('CtaBar', { label })).toContain('Call Us Today');
  });

  it('a stat keeps its number shape', () => {
    const fmt = fieldFormat('Number', '3.4x');
    expect(fitsFormat('4.2x', fmt, '3.4x')).toBe(true);
    expect(fitsFormat('Four point two', fmt, '3.4x')).toBe(false);
  });
});

describe('the whole-page writer fits every design', () => {
  // A deliberately careless "AI": lower-case with a full stop on everything.
  const careless = vi.fn(async (_url, init) => {
    const items = JSON.parse(init.body).input.items;
    return new Response(JSON.stringify({ ok: true, items: items.map((i) => ({ id: i.id, text: `${i.text.toLowerCase().replace(/[.!?]+$/, '')} now.` })) }), { status: 200 });
  });
  const headers = { 'X-OpenAI-Key': 'sk-test0123456789abcdefghijkl' };

  it('every change keeps the design\'s casing, ending, placeholders and highlight marks', async () => {
    let checked = 0; let caps = 0; let title = 0;
    for (const t of EDITABLE_TEMPLATES) {
      const data = t.editorData;
      const { changes } = await proposeRewrite(data, { instruction: 'x', fetchImpl: careless, headers });
      for (const c of changes) {
        checked += 1;
        const kind = caseOf(c.text);
        if (kind === 'upper') { caps += 1; expect(caseOf(c.after), `${t.id}: ${c.text} -> ${c.after}`).toBe('upper'); }
        if (kind === 'title') { title += 1; expect(caseOf(c.after), `${t.id}: ${c.text} -> ${c.after}`).toBe('title'); }
        const single = !/[.!?]\s+\p{L}/u.test(c.text) && !c.text.includes('\n');
        if (single && !/[.!?]$/.test(c.text.trim().replace(/\[\[|\]\]/g, ''))) expect(/\.$/.test(c.after), `${t.id}: ends with a full stop: ${c.after}`).toBe(false);
        expect((c.after.match(/\{\{[^}]*\}\}/g) || []).sort()).toEqual((c.text.match(/\{\{[^}]*\}\}/g) || []).sort());
        expect((c.after.match(/\[\[/g) || []).length).toBe((c.text.match(/\[\[/g) || []).length);
      }
    }
    expect(checked).toBeGreaterThan(500);
    expect(caps).toBeGreaterThan(0);
    expect(title).toBeGreaterThan(0);
  }, 120000);

  it('there is plenty of ALL-CAPS and Title Case text in the designs to protect', () => {
    let upper = 0; let titled = 0;
    for (const t of EDITABLE_TEMPLATES) for (const x of collectTexts(t.editorData)) { const k = caseOf(x.text); if (k === 'upper') upper += 1; if (k === 'title') titled += 1; }
    expect(upper).toBeGreaterThan(10);
    expect(titled).toBeGreaterThan(10);
  });
});
