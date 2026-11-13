// A card in the "Add to timeline" modal must always show something real. This fails when a new feature is added without a working preview.
import { describe, it, expect } from 'vitest';
import { buildCatalog, mgPreview, hfPreview, hfEntries, mgEntries } from '../components/edit/add-to-timeline-registry';
import { previewResolves } from '../components/edit/preview-types';
import { loadMgTemplates } from '../lib/occ/mg-templates';
import { hyperframesItems } from '../lib/hyperframes/overlay';
import { OVERLAY_KINDS, overlayTemplates, isConnectTemplate, createTemplateOverlays, createOverlay } from '../lib/overlays/overlays';
import fs from 'node:fs';

const noop = () => undefined;
const actions = { onAddKind: noop, onAddTemplate: noop };

describe('add-to-timeline catalog', () => {
  const entries = buildCatalog(actions, { close: noop, askPhone: noop });

  it('has an entry for every overlay kind and template (Smart Speech, Template Generator and Personalization have their own modals)', () => {
    for (const k of OVERLAY_KINDS) expect(entries.some((e) => e.id === k.kind)).toBe(true);
    for (const id of ['speech', 'generator', 'personalize']) expect(entries.some((e) => e.id === id)).toBe(false);
    expect(entries.filter((e) => e.tab === 'endscreens').length).toBeGreaterThan(5);
  });

  it('gives every entry a preview that resolves', () => {
    for (const e of entries) expect(previewResolves(e.preview), `${e.id} has no working preview`).toBe(true);
  });

  it('every motion graphic template and HyperFrames animation previews', async () => {
    (globalThis as { fetch?: unknown }).fetch = async (u: string) => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(`public${String(u)}`, 'utf8')) });
    const tpls = (await loadMgTemplates()).filter((t) => t.usable);
    expect(tpls.length).toBeGreaterThan(100);
    for (const t of tpls) expect(previewResolves(mgPreview(t)), t.id).toBe(true);
    for (const i of hyperframesItems()) expect(previewResolves(hfPreview(i)), i.id).toBe(true);
    // the All tab is built from these entries: every one needs a label, a preview and a click handler
    const all = [...hfEntries(hyperframesItems(), noop), ...mgEntries(tpls, noop), ...entries];
    expect(all.length).toBeGreaterThan(500);
    for (const e of all) { expect(e.label, e.id).toBeTruthy(); expect(typeof e.run, e.id).toBe('function'); }
    expect(new Set(all.map((e) => e.id)).size).toBe(all.length);
  });

  it('keeps preview identity stable so live renders do not restart', async () => {
    const [t] = (await loadMgTemplates()).filter((x) => x.usable);
    expect(mgPreview(t)).toBe(mgPreview(t));
  });

  it('a Connect Form template carries the phone number the modal asked for', () => {
    const t = overlayTemplates().find((x) => isConnectTemplate(x.id));
    expect(t).toBeTruthy();
    const made = createTemplateOverlays(t!.id, 0, 10, { phone: '212 555 0147' });
    expect(made.length).toBeGreaterThan(0);
    expect(JSON.stringify(made)).toContain('+1 212 555 0147');
  });

  it('every card adds the right thing: all animations, motion graphics, overlays and templates', async () => {
    const calls: string[] = [];
    const rec = (tag: string) => (x: unknown) => { calls.push(`${tag}:${typeof x === 'string' ? x : (x as { id: string }).id}`); };
    const ui = { close: () => { calls.push('close'); }, askPhone: (id: string) => { calls.push(`phone:${id}`); } };
    const fixed = buildCatalog({ onAddKind: rec('kind'), onAddTemplate: (id: string) => calls.push(`tpl:${id}`) }, ui);
    const tpls = (await loadMgTemplates()).filter((t) => t.usable);
    const hf = hyperframesItems();
    const all = [...hfEntries(hf, rec('hf')), ...mgEntries(tpls, rec('mg')), ...fixed];
    expect(all.length).toBeGreaterThan(500);
    for (const e of all) {
      calls.length = 0;
      e.run();
      expect(calls.length, `${e.id} did nothing`).toBeGreaterThan(0);
      if (e.tab === 'animations') expect(calls).toEqual([`hf:${e.id.slice(3)}`]);
      else if (e.tab === 'motion') expect(calls).toEqual([`mg:${e.id.slice(3)}`]);
      else if (e.tab === 'overlays') expect(calls).toEqual([`kind:${e.id}`, 'close']);
      else if (isConnectTemplate(e.id.slice(4))) expect(calls).toEqual([`phone:${e.id.slice(4)}`]); // asks for the phone first, adds nothing yet
      else expect(calls).toEqual([`tpl:${e.id.slice(4)}`, 'close']);
    }
    // the real creators produce valid clips for every overlay kind and every end-screen / connect template
    for (const k of OVERLAY_KINDS) { const o = createOverlay(k.kind, 0, 10); expect(o.type, k.kind).toBe(k.kind); expect(o.end, k.kind).toBeGreaterThan(o.start); }
    for (const t of overlayTemplates()) { const made = createTemplateOverlays(t.id, 0, 10); expect(made.length, t.id).toBeGreaterThan(0); for (const o of made) expect(o.end, t.id).toBeGreaterThan(o.start); }
  });

  it('the List Builder card preview has no pointer hint, but the overlay that gets added keeps it', () => {
    const entry = buildCatalog(actions, { close: noop, askPhone: noop }).find((e) => e.id === 'list-builder')!;
    const [shown] = entry.preview.build();
    expect((shown.config as { pointerEnabled?: boolean }).pointerEnabled).toBe(false);
    const added = createOverlay('list-builder', 0, 10);
    expect((added.config as { pointerEnabled?: boolean }).pointerEnabled).not.toBe(false);
  });
});
