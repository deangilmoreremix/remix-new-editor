// [hyperframes] additive overlay kind: flag default, persistence, search, override mapping, layer building.
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { normalizeOverlays } from '@cinegen/lib/overlays/overlays';
import { createHyperframesOverlay, overridesFromProps, hyperframesOverlayLayer, searchHyperframes, type HfItem } from '@cinegen/lib/hyperframes/overlay';
// @ts-expect-error plain JS flag
import { isHyperframesEnabled } from '../../lib/hyperframes/featureFlag.js';

const item: HfItem = {
  id: 'lt-clean-bar', title: 'Lower Third — Clean Bar', description: 'Minimal white-card lower third', tags: ['lower-third', 'overlay'], category: 'lower-third',
  dimensions: { width: 1920, height: 1080 }, duration: 4.8, sourceSha256: 'x'.repeat(64),
  editables: [
    { key: 'name', label: 'Name', type: 'text', defaultValue: 'Dr. Maya Chen', target: { hfId: 'hf-tjqa', kind: 'text' } },
    { key: 'role', label: 'Role', type: 'text', defaultValue: 'Host', target: { hfId: 'hf-jkgi', kind: 'text' } },
    { key: 'accent', label: 'Accent', type: 'color', defaultValue: '#ff5a36', target: { hfId: 'hf-0l4y', kind: 'style', prop: 'backgroundColor' } },
  ],
};

describe('HyperFrames feature flag', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());
  it('is OFF by default', () => expect(isHyperframesEnabled()).toBe(false));
  it('turns on only for the exact QA value', () => {
    localStorage.setItem('remix.hyperframes.v1', 'true'); expect(isHyperframesEnabled()).toBe(false);
    localStorage.setItem('remix.hyperframes.v1', '1'); expect(isHyperframesEnabled()).toBe(true);
  });
});

describe('HyperFrames overlay', () => {
  it('creates a lane overlay at the playhead with the master defaults and a prop schema', () => {
    const o = createHyperframesOverlay(item, 3);
    expect(o).toMatchObject({ type: 'hyperframes', blockId: 'lt-clean-bar', start: 3, end: 7.8, hfSchema: 1 });
    expect(o.props).toEqual({ name: 'Dr. Maya Chen', role: 'Host', accent: '#ff5a36' });
    expect((o.propSchema as unknown[]).length).toBe(3);
  });
  it('maps only EDITED props to a sparse SDK-style OverrideSet; the master defaults produce nothing', () => {
    expect(overridesFromProps(item, createHyperframesOverlay(item, 0).props as Record<string, unknown>)).toEqual({});
    expect(overridesFromProps(item, { name: "Maria's Bakery", role: 'Host', accent: '#e11d48' })).toEqual({ 'hf-tjqa.text': "Maria's Bakery", 'hf-0l4y.style.backgroundColor': '#e11d48' });
  });
  it('survives a save and reload (JSON round trip + normalizeOverlays) while unknown kinds are still dropped', () => {
    const o = createHyperframesOverlay(item, 1);
    const restored = normalizeOverlays(JSON.parse(JSON.stringify([o, { id: 'x', type: 'not-a-kind', start: 0, end: 1, name: 'x' }])));
    expect(restored).toHaveLength(1);
    expect(restored[0]).toEqual(o);
  });
  it('builds a composition layer with frame timing; a non-enabled block yields an empty-override layer (renders nothing)', () => {
    const o = { ...createHyperframesOverlay(item, 2), end: 6.5 };
    const l = hyperframesOverlayLayer(o, 30);
    expect(l).toMatchObject({ kind: 'hyperframes', from: 60, durationInFrames: 135, blockId: 'lt-clean-bar', blockWidth: 1920, blockHeight: 1080 });
    expect(l.overrides).toEqual({}); // 'lt-clean-bar' is not in the (still empty) enabled list in this unit test environment, so no overrides are derived
  });
});

describe('HyperFrames catalog search', () => {
  const items = [item, { ...item, id: 'glitch', title: 'Glitch transition', description: 'Digital glitch cut', tags: ['transition'], category: 'transition' }];
  it('filters by text and by category, and returns everything for an empty query', () => {
    expect(searchHyperframes(items, '').length).toBe(2);
    expect(searchHyperframes(items, 'glitch').map((i) => i.id)).toEqual(['glitch']);
    expect(searchHyperframes(items, '', 'lower-third').map((i) => i.id)).toEqual(['lt-clean-bar']);
    expect(searchHyperframes(items, 'zzz')).toEqual([]);
  });
});
