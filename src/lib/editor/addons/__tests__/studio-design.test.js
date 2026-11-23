import { describe, it, expect } from 'vitest';
import '../index.js';
import { createAddonClip, getAddon, resolveStudioDesignOptions, slotsForDesign, defaultStudioDesignOptions } from '../index.js';
import { timelineToComposition } from '../../remotion/timelineToComposition.js';

const design = {
  id: 'logo-reveal',
  textSlots: [{ key: 'name', field: 'businessName', primary: true }, { key: 'line', field: 'offer' }],
};
const ann = { id: 'c-ann', contact: { name: 'Ann' }, variables: {}, personalization: { business: { businessName: 'Acme Plumbing', offer: '10% off' }, assets: {} } };
const bob = { id: 'c-bob', contact: { name: 'Bob' }, variables: {} };

describe('Studio Design addon', () => {
  it('is a registered overlay, so exports render it instead of dropping it', () => {
    const a = getAddon('overlay-studio-design');
    expect(a.category).toBe('overlay');
    const clip = createAddonClip('overlay-studio-design', { startSec: 2, timelineSeconds: 30 });
    expect(clip.addon.designId).toBe('');
    expect(clip.addon.media.logo).toBe('{{logoUrl}}');
  });

  it('fills empty slots with the contact token for their field', () => {
    expect(slotsForDesign(design)).toEqual({ name: '{{businessName}}', line: '{{offer}}' });
    expect(slotsForDesign(design, { primaryText: 'Hello', overrides: { line: 'Free quote' } })).toEqual({ name: 'Hello', line: 'Free quote' });
    expect(slotsForDesign(design, { primaryText: 'Acme Plumbing', brand: { businessName: 'Acme Plumbing' } }).name).toBe('{{businessName}}');
  });

  it('resolves slots per contact and blanks what a contact lacks', () => {
    const o = defaultStudioDesignOptions(design);
    expect(resolveStudioDesignOptions(o, ann).slots).toEqual({ name: 'Acme Plumbing', line: '10% off' });
    const none = resolveStudioDesignOptions(o, bob);
    expect(none.slots.line).toBe('');
    expect(none.media.logo).toBeNull();
  });

  it('keeps only valid colors and safe image urls', () => {
    const o = { ...defaultStudioDesignOptions(design), colors: { primary: '#ff0000', accent: 'url(javascript:alert(1))', text: '{{brandColor}}' }, media: { logo: 'javascript:alert(1)', product: 'https://cdn.test/p.png' } };
    const r = resolveStudioDesignOptions(o, ann);
    expect(r.colors).toEqual({ primary: '#ff0000', accent: '#22c55e', text: '#ffffff' });
    expect(r.media).toEqual({ logo: null, product: 'https://cdn.test/p.png' });
  });

  it('a design clip takes each contact\'s own brand colors, and the Studio defaults when a contact has none', () => {
    const o = defaultStudioDesignOptions(design);
    expect(o.colors).toEqual({ primary: '{{brandColor}}', accent: '{{accentColor}}', text: '#ffffff' });
    const red = { ...ann, brand: { colors: { primary: '#e11d48', accent: '#f59e0b' } } };
    expect(resolveStudioDesignOptions(o, red).colors).toEqual({ primary: '#e11d48', accent: '#f59e0b', text: '#ffffff' });
    expect(resolveStudioDesignOptions(o, ann).colors).toEqual({ primary: '#d9ff00', accent: '#22c55e', text: '#ffffff' }); // no colors: as before
    const half = { ...ann, brand: { colors: { primary: '#0ea5e9' } } };
    expect(resolveStudioDesignOptions(o, half).colors).toEqual({ primary: '#0ea5e9', accent: '#22c55e', text: '#ffffff' });
    const bad = { ...ann, brand: { colors: { primary: 'red; background:url(x)' } } };
    expect(resolveStudioDesignOptions(o, bad).colors.primary).toBe('#d9ff00'); // never an unchecked string
  });

  it('timelineToComposition emits a per-contact overlay layer, not a skipped one', () => {
    const clip = { ...createAddonClip('overlay-studio-design', { startSec: 1, timelineSeconds: 20 }) };
    clip.addon = defaultStudioDesignOptions(design);
    const state = { timelineSeconds: 20, tracks: [{ id: 't', type: 'text', name: 'Text', items: [clip] }] };
    const a = timelineToComposition(state, { profile: ann });
    const b = timelineToComposition(state, { profile: bob });
    expect(a.skipped).toEqual([]);
    const layer = a.layers.find((l) => l.type === 'overlay-studio-design');
    expect(layer.kind).toBe('overlay');
    expect(layer.options.slots.name).toBe('Acme Plumbing');
    expect(b.layers.find((l) => l.type === 'overlay-studio-design').options.slots.name).toBe('');
  });
});
