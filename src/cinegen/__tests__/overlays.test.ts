// [remix] Overlays on the video: reducer actions, creation defaults (old add-on options, red button), persistence normalizer.
import { describe, it, expect } from 'vitest';
import { workspaceReducer, createInitialWorkspaceState } from '@cinegen/lib/mcp/workspace-state';
import { createOverlay, normalizeOverlays, overlaysAt, findGate, isGateOverlay, startAfterGate, GATE_SECONDS } from '@cinegen/lib/overlays/overlays';
import { overlaySchema } from '@cinegen/lib/overlays/descriptors';
import { textEditUpdates } from '@cinegen/lib/overlays/text-edit';

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
  it('the List Builder is a locked gate at 0s, one per video (whatever the playhead says)', () => {
    const o = createOverlay('list-builder', 12, 30) as unknown as { start: number; end: number; config: { enabled: boolean; backdropOpacity: number; pointerStyle: string } };
    expect(o.start).toBe(0);
    expect(o.end).toBe(GATE_SECONDS);
    expect(o.config).toMatchObject({ enabled: true, backdropOpacity: 100, pointerStyle: 'curly' });
    const lead = createOverlay('lead-form', 12, 30);
    expect(isGateOverlay(lead)).toBe(false);
    expect(findGate([lead, createOverlay('list-builder', 0, 30)])?.type).toBe('list-builder');
    expect(findGate([lead])).toBeUndefined();
    // a new form never lands on top of the gate
    expect(startAfterGate([createOverlay('list-builder', 0, 30)], 0)).toBe(GATE_SECONDS);
    expect(startAfterGate([createOverlay('list-builder', 0, 30)], 8)).toBe(8);
    expect(startAfterGate([], 0)).toBe(0);
  });
  it('the Lead Generator and List Builder share one settings schema (Styles / Fields / Pointer / Integrations)', () => {
    const lead = overlaySchema(createOverlay('lead-form', 2, 30));
    const tabs = (kind: Record<string, unknown>) => new Set((lead.fieldsFor as (o: unknown) => Array<{ tab: string }>)(kind).map((f) => f.tab));
    expect(tabs(lead.options)).toEqual(new Set(['Text', 'Styles', 'Fields', 'Pointer', 'Integrations']));
    expect(lead.options).toMatchObject({ kind: 'lead-generator', btnText: 'Play', buttonBackground: '#eb5054', pointerEnabled: false });
    const lb = overlaySchema(createOverlay('list-builder', 0, 30));
    expect(lb.options).toMatchObject({ kind: 'list-builder', pointerEnabled: true });
  });
  it('clicking text on the form updates the overlay (List Builder config / Lead Generator clip)', () => {
    const lb = createOverlay('list-builder', 0, 30);
    const a = textEditUpdates(lb, 'btnText', 'Watch now') as { config: Record<string, unknown> };
    expect(a.config.btnText).toBe('Watch now');
    expect(a.config.caption).toBe((lb as unknown as { config: { caption: string } }).config.caption); // the rest is kept
    const lead = createOverlay('lead-form', 2, 30);
    const b = textEditUpdates(lead, 'caption', 'Tell us about you') as unknown as { heading: string; start?: number; id?: string };
    expect(b.heading).toBe('Tell us about you');
    expect('id' in b || 'start' in b).toBe(false); // timing and identity are never touched
    const c = textEditUpdates(lead, 'btnText', 'Send') as unknown as { ctaText: string };
    expect(c.ctaText).toBe('Send');
    const d = textEditUpdates(lead, 'elements.0.placeholder', 'you@work.com') as unknown as { fields: Array<{ placeholder?: string }> };
    expect(d.fields[0].placeholder).toBe('you@work.com');
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

import { createTemplateOverlays, overlayTemplates } from '@cinegen/lib/overlays/overlays';
describe('end screen / connect templates on the overlay lane', () => {
  it('lists the old editor libraries and turns a template into overlay clips', () => {
    const list = overlayTemplates();
    expect(list.some((t) => t.library === 'endScreens')).toBe(true);
    expect(list.some((t) => t.library === 'connect')).toBe(true);
    const made = createTemplateOverlays('es-thanks', 0, 30);
    expect(made.length).toBeGreaterThan(1);
    expect(made.every((o) => o.end > o.start)).toBe(true);
    expect(Math.max(...made.map((o) => o.end))).toBeLessThanOrEqual(30);
    expect(Math.min(...made.map((o) => o.start))).toBeGreaterThan(20); // end screens sit at the end
  });
});
