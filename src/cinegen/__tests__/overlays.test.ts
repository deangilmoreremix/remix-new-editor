// [remix] Overlays on the video: reducer actions, creation defaults (old add-on options, red button), persistence normalizer.
import { describe, it, expect } from 'vitest';
import { workspaceReducer, createInitialWorkspaceState } from '@cinegen/lib/mcp/workspace-state';
import { createOverlay, normalizeOverlays, overlaysAt } from '@cinegen/lib/overlays/overlays';

describe('overlays', () => {
  it('creates a Lead Generator with the old add-on defaults (red button, email field)', () => {
    const o = createOverlay('lead-form', 2, 30) as unknown as { type: string; start: number; end: number; ctaText: string; fields: Array<{ type: string }>; style: { buttonColor: string } };
    expect(o.type).toBe('lead-form');
    expect(o.start).toBe(2);
    expect(o.end).toBeGreaterThan(2);
    expect(o.ctaText).toBe('Play');
    expect(o.fields[0].type).toBe('email');
    expect(o.style.buttonColor).toBe('#eb5054');
  });
  it('creates a List Builder with its config', () => {
    const o = createOverlay('list-builder', 0, 30) as unknown as { config: { btnText: string; buttonBackground: string } };
    expect(o.config.btnText).toBe('Play');
    expect(o.config.buttonBackground).toBe('#eb5054');
  });
  it('adds, updates and removes overlays through the reducer', () => {
    let s = createInitialWorkspaceState();
    const o = createOverlay('click-to-call', 1, 20);
    s = workspaceReducer(s, { type: 'ADD_OVERLAY', overlay: o });
    expect(s.overlays).toHaveLength(1);
    s = workspaceReducer(s, { type: 'UPDATE_OVERLAY', overlayId: o.id, updates: { start: 3, end: 6 } });
    expect(s.overlays[0]).toMatchObject({ start: 3, end: 6 });
    expect(overlaysAt(s.overlays, 4)).toHaveLength(1);
    expect(overlaysAt(s.overlays, 7)).toHaveLength(0);
    s = workspaceReducer(s, { type: 'REMOVE_OVERLAY', overlayId: o.id });
    expect(s.overlays).toHaveLength(0);
  });
  it('drops malformed saved overlays', () => {
    expect(normalizeOverlays([{ type: 'nope', start: 1 }, { type: 'lead-form', start: 'x' }, { type: 'lead-form', start: 1, end: 2, id: 'a', name: 'L' }])).toHaveLength(1);
    expect(normalizeOverlays(undefined)).toEqual([]);
  });
});

describe('registry overlay kinds', () => {
  it('creates Smart Text, Lower Thirds and Stickers from the old add-on registry (options under `addon`)', () => {
    const text = createOverlay('overlay-text', 1, 20) as unknown as { type: string; addon: { text: string; geometry: { width: number } } };
    expect(text.type).toBe('overlay-text');
    expect(text.addon.text).toBe('Enter Text Here');
    expect(text.addon.geometry.width).toBeGreaterThan(0);
    expect(createOverlay('overlay-lower-third', 0, 20).name).toBe('Lower Thirds');
    expect(createOverlay('overlay-sticker', 0, 20).type).toBe('overlay-sticker');
  });
  it('keeps registry overlays when normalizing saved state', () => {
    const o = createOverlay('overlay-image', 0, 10);
    expect(normalizeOverlays([o])).toHaveLength(1);
  });
});
