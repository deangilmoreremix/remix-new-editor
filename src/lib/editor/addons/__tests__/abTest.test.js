// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { pickVariant, applyVariant, hasVariantB, variantFor, listBuilderFields, defaultListBuilder, leadFormToOptin, applyOptinToLeadForm } from '../index.js';

const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) }; };
const cfg = { caption: 'Join', btnText: 'Play', abTest: true, variantBCaption: 'Get the video free', variantBBtnText: '' };

describe('pickVariant', () => {
  it('assigns A or B once and remembers it', () => {
    const storage = memory();
    const first = pickVariant('vid1', { storage, rand: () => 0.9 });
    expect(first).toBe('B');
    expect(pickVariant('vid1', { storage, rand: () => 0.1 })).toBe('B'); // stays the same
    expect(pickVariant('vid2', { storage, rand: () => 0.1 })).toBe('A'); // per video
  });
  it('works when storage is blocked', () => {
    const blocked = { getItem: () => { throw new Error('no'); }, setItem: () => { throw new Error('no'); } };
    expect(['A', 'B']).toContain(pickVariant('x', { storage: blocked }));
  });
});

describe('applyVariant', () => {
  it('leaves version A and untested forms alone', () => {
    expect(applyVariant(cfg, 'A')).toBe(cfg);
    expect(applyVariant({ ...cfg, abTest: false }, 'B').caption).toBe('Join');
    expect(applyVariant({ ...cfg, variantBCaption: '', variantBBtnText: '' }, 'B').caption).toBe('Join'); // nothing to test
  });
  it('version B swaps in what was written, keeps the rest, never mutates', () => {
    const b = applyVariant(cfg, 'B');
    expect(b.caption).toBe('Get the video free'); expect(b.btnText).toBe('Play'); // empty B button = same as A
    expect(cfg.caption).toBe('Join');
    expect(applyVariant({ ...cfg, variantBBtnText: 'Watch' }, 'B').btnText).toBe('Watch');
  });
  it('records a version only for forms being tested', () => {
    expect(hasVariantB(cfg)).toBe(true);
    expect(variantFor(cfg, 'B')).toBe('B');
    expect(variantFor({ ...cfg, abTest: false }, 'B')).toBe('');
    expect(variantFor(cfg, 'C')).toBe('');
  });
});

describe('settings', () => {
  it('B fields appear once the test is on, and survive the Lead Generator clip', () => {
    const shown = (o) => listBuilderFields(o).filter((f) => !f.showIf || f.showIf(o)).map((f) => f.key);
    expect(shown(defaultListBuilder())).toContain('abTest');
    expect(shown(defaultListBuilder())).not.toContain('variantBCaption');
    expect(shown({ ...defaultListBuilder(), abTest: true })).toEqual(expect.arrayContaining(['variantBCaption', 'variantBBtnText']));
    const clip = { fields: [] };
    applyOptinToLeadForm(clip, { elements: [{ id: 'e', type: 'email', label: 'Email' }], abTest: true, variantBCaption: 'B!' });
    expect(leadFormToOptin(clip)).toMatchObject({ abTest: true, variantBCaption: 'B!' });
  });
});
