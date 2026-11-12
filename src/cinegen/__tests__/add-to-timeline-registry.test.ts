// A card in the "Add to timeline" modal must always show something real. This fails when a new feature is added without a working preview.
import { describe, it, expect } from 'vitest';
import { buildCatalog, mgPreview, hfPreview } from '../components/edit/add-to-timeline-registry';
import { previewResolves } from '../components/edit/preview-types';
import { loadMgTemplates } from '../lib/occ/mg-templates';
import { hyperframesItems } from '../lib/hyperframes/overlay';
import { OVERLAY_KINDS } from '../lib/overlays/overlays';
import fs from 'node:fs';

const noop = () => undefined;
const actions = { onPickMotion: noop, onAddKind: noop, onAddTemplate: noop, onOpenGenerator: noop, onOpenPersonalization: noop };

describe('add-to-timeline catalog', () => {
  const entries = buildCatalog(actions, { close: noop, askPhone: noop });

  it('has an entry for every overlay kind, AI feature and template (Smart Speech has its own modal)', () => {
    for (const k of OVERLAY_KINDS) expect(entries.some((e) => e.id === k.kind)).toBe(true);
    for (const id of ['generator', 'personalize']) expect(entries.some((e) => e.id === id)).toBe(true);
    expect(entries.some((e) => e.id === 'speech')).toBe(false);
    expect(entries.filter((e) => e.tab === 'endscreens').length).toBeGreaterThan(5);
  });

  it('gives every entry a preview that resolves', () => {
    for (const e of entries) expect(previewResolves(e.preview), `${e.id} has no working preview`).toBe(true);
  });

  it('video previews point at files that exist', () => {
    for (const e of entries) if (e.preview.kind === 'video') expect(fs.existsSync(`public${e.preview.src}`), e.preview.src).toBe(true);
  });

  it('every motion graphic template and HyperFrames animation previews', async () => {
    (globalThis as { fetch?: unknown }).fetch = async (u: string) => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(`public${String(u)}`, 'utf8')) });
    const tpls = (await loadMgTemplates()).filter((t) => t.usable);
    expect(tpls.length).toBeGreaterThan(100);
    for (const t of tpls) expect(previewResolves(mgPreview(t)), t.id).toBe(true);
    for (const i of hyperframesItems()) expect(previewResolves(hfPreview(i)), i.id).toBe(true);
  });

  it('keeps preview identity stable so live renders do not restart', async () => {
    const [t] = (await loadMgTemplates()).filter((x) => x.usable);
    expect(mgPreview(t)).toBe(mgPreview(t));
  });
});
