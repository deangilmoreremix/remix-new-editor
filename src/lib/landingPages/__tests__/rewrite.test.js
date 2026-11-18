import { describe, it, expect, vi } from 'vitest';
import { collectTexts, applyChanges, checkRewrite, proposeRewrite, sectionList, isCopy } from '../rewrite.js';
import { PUCK_TEMPLATES } from '../puck/designs.js';

const data = {
  root: { props: {} }, zones: {},
  content: [
    { type: 'Hero', props: { id: 'h', variant: 'story', background: 'https://x.io/a.jpg', headline: 'Hi {{firstname|there}}, grow [[faster]]', subhead: 'A short subhead.', buttons: [{ label: 'Book now', url: 'https://x.io/book', style: 'primary' }], formFields: [{ key: 'name', label: 'Your name', type: 'text' }], showForm: 'yes' } },
    { type: 'Grid', props: { id: 'g', columns: 3, items: [{ type: 'QuoteCard', props: { id: 'q', quotes: [{ text: 'Great product.', name: 'Ann B.', role: 'CEO, Acme', avatar: '/a.webp' }] } }] } },
  ],
};

describe('landing page AI rewrite', () => {
  it('lists copy only: never urls, ids, enums, form fields or media', () => {
    const t = collectTexts(data);
    const texts = t.map((x) => x.text);
    expect(texts).toEqual(expect.arrayContaining(['Hi {{firstname|there}}, grow [[faster]]', 'A short subhead.', 'Book now', 'Great product.', 'Ann B.', 'CEO, Acme']));
    expect(texts.join('|')).not.toMatch(/story|https:|Your name|avatar|primary|yes/);
  });
  it('can be limited to one section', () => {
    expect(collectTexts(data, { section: 1 }).every((x) => x.section === 1)).toBe(true);
    expect(sectionList(data).map((s) => s.count)).toEqual([3, 3]);
  });
  it('accepts an answer only when tokens, markers and line breaks survive', () => {
    expect(checkRewrite('Hi {{firstname|there}}, grow [[faster]]', 'Hello {{firstname|there}}, scale [[quickly]]')).toBe(true);
    expect(checkRewrite('Hi {{firstname|there}}', 'Hi there')).toBe(false);
    expect(checkRewrite('Grow [[faster]]', 'Grow faster')).toBe(false);
    expect(checkRewrite('a\nb', 'a b')).toBe(false);
    expect(checkRewrite('Book now', '<b>Book</b> now')).toBe(false);
    expect(checkRewrite('Book now', 'Visit https://evil.test')).toBe(false);
    expect(checkRewrite('Book now', 'Book now')).toBe(false);
  });
  it('writes accepted text back at exact paths and changes nothing else', () => {
    const items = collectTexts(data);
    const changes = items.map((i) => ({ ...i, after: i.text.toUpperCase().includes('{{') ? i.text : `${i.text} ✓` }));
    const next = applyChanges(data, changes);
    const strip = (d) => JSON.stringify(d, (k, v) => (typeof v === 'string' ? '' : v));
    expect(strip(next)).toBe(strip(data)); // identical structure
    expect(next.content[0].props.buttons[0].url).toBe('https://x.io/book');
    expect(next.content[0].props.buttons[0].label).toBe('Book now ✓');
    expect(next.content[0].props.formFields).toEqual(data.content[0].props.formFields);
    expect(data.content[0].props.buttons[0].label).toBe('Book now'); // input untouched
  });
  it('drops unsafe answers and keeps the rest', async () => {
    const fetchImpl = vi.fn(async (url, init) => {
      const { input } = JSON.parse(init.body);
      expect(url).toBe('/api/landing-rewrite');
      expect(JSON.stringify(input)).not.toMatch(/https:|avatar|story/);
      return new Response(JSON.stringify({ ok: true, items: input.items.map((i) => ({ id: i.id, text: i.text.includes('{{') ? 'No tokens here' : `${i.text} (new)` })) }), { status: 200 });
    });
    const r = await proposeRewrite(data, { instruction: 'friendlier', fetchImpl, headers: { 'X-OpenAI-Key': 'sk-test' } });
    expect(r.changes.length).toBe(5);
    expect(r.skipped).toBe(1); // the token one was rejected
    expect(r.changes.every((c) => !c.after.includes('No tokens'))).toBe(true);
  });
  it('needs the user key and never calls the network without it', async () => {
    const fetchImpl = vi.fn();
    await expect(proposeRewrite(data, { fetchImpl, headers: {} })).rejects.toThrow(/OpenAI key/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('every shipped design has rewritable copy and rewriting never alters its structure', () => {
    for (const t of PUCK_TEMPLATES) {
      const items = collectTexts(t.puckData);
      expect(items.length, t.id).toBeGreaterThan(3);
      const next = applyChanges(t.puckData, items.map((i) => ({ ...i, after: `${i.text} x` })));
      const shape = (d) => JSON.stringify(d, (k, v) => (typeof v === 'string' ? '' : v));
      expect(shape(next), t.id).toBe(shape(t.puckData));
    }
  });
  it('isCopy rejects settings', () => {
    expect(isCopy('variant', 'story')).toBe(false);
    expect(isCopy('headline', 'Grow faster')).toBe(true);
    expect(isCopy('url', 'Grow faster')).toBe(false);
  });
});
