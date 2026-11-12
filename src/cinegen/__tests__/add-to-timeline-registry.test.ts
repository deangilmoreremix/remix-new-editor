// A card in the "Add to timeline" modal must always show something real. This fails when a new feature is added without a working preview.
import { describe, it, expect } from 'vitest';
import { buildCatalog, mgPreview, hfPreview, hfEntries, mgEntries } from '../components/edit/add-to-timeline-registry';
import { previewResolves } from '../components/edit/preview-types';
import { loadMgTemplates } from '../lib/occ/mg-templates';
import { hyperframesItems } from '../lib/hyperframes/overlay';
import { OVERLAY_KINDS, overlayTemplates, isConnectTemplate, createTemplateOverlays } from '../lib/overlays/overlays';
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
});
