import { describe, it, expect } from 'vitest';
import { sampleSections } from '../sampleContent.js';
import { EDITABLE_TEMPLATES } from '../editor/designs.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
const designs = EDITABLE_TEMPLATES.filter((t) => t.designClass);

describe('sample-content guard', () => {
  it.each(designs.map((t) => [t.name, t]))('%s: an untouched page lists its sample sections', (_n, t) => {
    const left = sampleSections(t.editorData, t.editorData, t.sampleTypes || []);
    expect(left.length, 'every design ships some sample proof').toBeGreaterThan(0);
  });
  it('editing a section removes it from the list', () => {
    const t = EDITABLE_TEMPLATES.find((x) => x.id === 'editable-lead');
    const before = sampleSections(t.editorData, t.editorData);
    const data = clone(t.editorData);
    // the quote card may live inside any slot container (Grid or a design's own grid)
    const find = (items, type) => { for (const c of items) { if (c.type === type) return c; for (const v of Object.values(c.props || {})) { if (Array.isArray(v) && v.length && v.every((x) => x && x.type && x.props)) { const f = find(v, type); if (f) return f; } } } return null; };
    const quote = find(data.content, 'QuoteCard');
    quote.props.quotes[0].text = 'A real customer said this.';
    const after = sampleSections(data, t.editorData);
    expect(after.length).toBe(before.length - 1);
    expect(after.some((x) => x.id === quote.props.id)).toBe(false);
  });
  it('icon benefit strips and plain text sections are not treated as proof', () => {
    const data = { root: { props: {} }, zones: {}, content: [{ type: 'Strip', props: { id: 's', kind: 'benefits', items: [] } }, { type: 'TextBlock', props: { id: 't', title: 'x' } }, { type: 'Strip', props: { id: 'l', kind: 'logos', items: [{ title: 'Acme' }] } }] };
    expect(sampleSections(data, data).map((x) => x.id)).toEqual(['l']);
  });
  it('a section added by the user is never flagged, and nothing is flagged without a template', () => {
    const t = designs[0];
    const data = clone(t.editorData);
    data.content.push({ type: 'QuoteCard', props: { id: 'mine', quotes: [{ text: 'mine' }] } });
    expect(sampleSections(data, t.editorData, t.sampleTypes || []).some((x) => x.id === 'mine')).toBe(false);
    expect(sampleSections(data, null)).toEqual([]);
    expect(sampleSections(null, t.editorData)).toEqual([]);
  });
});
