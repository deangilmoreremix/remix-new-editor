// Lead Generator / List Builder designs go through the SAME creation logic as the plain ones: createOverlay (gate at 0s, one List Builder
// per video, start after the gate) and the "Add to timeline" catalog. These tests pin that.
import { describe, it, expect, vi } from 'vitest';
import { createOverlay, applyDesignToOverlay, FORM_DESIGNS, GATE_SECONDS, findGate, startAfterGate } from '../lib/overlays/overlays';
import { buildCatalog } from '../components/edit/add-to-timeline-registry';
import { previewResolves } from '../components/edit/preview-types';
// @ts-expect-error plain JS
import { leadFormToOptin, switchListBuilderKind, normalizeListBuilder } from '../../lib/editor/addons/listBuilder.js';

const noop = () => undefined;
const cfg = (o: unknown) => (o as { config: Record<string, unknown> }).config;

describe('creating a Lead Generator / List Builder with a design', () => {
  it('there are 30 designs, and each one is created for both kinds', () => {
    expect(FORM_DESIGNS).toHaveLength(30);
    for (const d of FORM_DESIGNS) {
      const lead = createOverlay('lead-form', 4, 20, d.id);
      expect(lead.type).toBe('lead-form');
      expect(lead.start).toBe(4);
      expect(leadFormToOptin(lead).designPreset, d.id).toBe(d.id);
      expect(leadFormToOptin(lead).elements.length, d.id).toBeGreaterThanOrEqual(3); // the design's starter boxes

      const list = createOverlay('list-builder', 4, 20, d.id);
      // the List Builder is still a locked gate at 0s that takes no video time
      expect(list.type).toBe('list-builder');
      expect(list.start).toBe(0);
      expect(list.end).toBe(GATE_SECONDS);
      expect(cfg(list).enabled).toBe(true);
      expect(cfg(list).designPreset, d.id).toBe(d.id);
    }
  });

  it('without a design nothing changes: the plain Lead Generator and List Builder are created as before', () => {
    expect(leadFormToOptin(createOverlay('lead-form', 0, 10)).designPreset).toBe('');
    expect(cfg(createOverlay('list-builder', 0, 10)).designPreset).toBe('');
    expect(createOverlay('lead-form', 0, 10, 'no-such-design').heading).toBe(createOverlay('lead-form', 0, 10).heading);
    expect(cfg(createOverlay('list-builder', 0, 10, 'no-such-design')).designPreset).toBe('');
  });

  it('other overlay kinds ignore a design', () => {
    const cta = createOverlay('click-to-call', 0, 10, 'glass-split');
    expect(JSON.stringify(cta)).not.toContain('glass-split');
  });

  it('the one-List-Builder rule still holds: a design picked for an existing List Builder is applied to it, and the creator\'s own wording is kept', () => {
    const gate = createOverlay('list-builder', 0, 10);
    expect(findGate([gate])?.id).toBe(gate.id);
    expect(startAfterGate([gate], 0)).toBe(GATE_SECONDS); // a new Lead Generator never lands on the gate's marker
    const mine = { ...gate, config: { ...cfg(gate), caption: 'Join my list', btnText: 'Count me in' } };
    const updated = applyDesignToOverlay(mine as never, 'aurora-glass');
    expect(cfg(updated).designPreset).toBe('aurora-glass');
    expect(cfg(updated).caption).toBe('Join my list');
    expect(cfg(updated).btnText).toBe('Count me in');
    expect(updated.id).toBe(gate.id);
  });

  it('a List Builder keeps its design when switched to a Personalizer (and back); the kind\'s own wording still switches', () => {
    const lb = createOverlay('list-builder', 0, 10, 'vip-access');
    const p = switchListBuilderKind(cfg(lb), 'personalizer');
    expect(p.kind).toBe('personalizer');
    expect(p.designPreset).toBe('vip-access');
    expect(p.badgeIcon).toBe('crown');
    expect(p.fontFamily).toBe(cfg(lb).fontFamily);
    expect(normalizeListBuilder(switchListBuilderKind(p, 'list-builder')).designPreset).toBe('vip-access');
    // without a design a switch gives the other kind's own defaults, as before
    const plain = switchListBuilderKind(cfg(createOverlay('list-builder', 0, 10)), 'personalizer');
    expect(plain.designPreset).toBe('');
    expect(plain.backgroundColor).toBe('#272735');
  });
});

describe('the Add to timeline catalog has a card for every design, for both kinds', () => {
  const calls: Array<[string, string | undefined]> = [];
  const entries = buildCatalog({ onAddKind: (k: string, d?: string) => { calls.push([k, d]); }, onAddTemplate: noop }, { close: noop, askPhone: noop });
  const cards = entries.filter((e) => e.id.startsWith('design:'));

  it('60 cards, unique, each with a preview that really renders', () => {
    expect(cards).toHaveLength(60);
    expect(new Set(cards.map((c) => c.id)).size).toBe(60);
    for (const c of cards) {
      expect(c.tab).toBe('overlays');
      expect(previewResolves(c.preview), c.id).toBe(true);
      const clips = (c.preview as { build: () => Array<{ type: string }> }).build();
      expect(clips.length, c.id).toBe(1);
      expect(['lead-form', 'list-builder']).toContain(clips[0].type);
    }
  });

  it('clicking a card creates that kind with that design', () => {
    calls.length = 0;
    const lead = cards.find((c) => c.id === 'design:lead-form:glass-split')!;
    const list = cards.find((c) => c.id === 'design:list-builder:glass-split')!;
    lead.run(); list.run();
    expect(calls).toEqual([['lead-form', 'glass-split'], ['list-builder', 'glass-split']]);
  });

  it('the plain cards are still there and unchanged', () => {
    for (const id of ['lead-form', 'list-builder']) expect(entries.some((e) => e.id === id)).toBe(true);
    const run = vi.fn();
    buildCatalog({ onAddKind: run, onAddTemplate: noop }, { close: noop, askPhone: noop }).find((e) => e.id === 'lead-form')!.run();
    expect(run).toHaveBeenCalledWith('lead-form'); // no design: exactly the call it made before
  });

  it('they can be found by searching the design name or style', () => {
    const hay = (c: { label: string; blurb: string; keywords?: string }) => `${c.label} ${c.blurb} ${c.keywords ?? ''}`.toLowerCase();
    expect(cards.filter((c) => hay(c).includes('glass split')).map((c) => c.id).sort()).toEqual(['design:lead-form:glass-split', 'design:list-builder:glass-split']);
  });
});
