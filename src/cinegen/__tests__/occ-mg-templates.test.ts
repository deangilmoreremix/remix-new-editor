import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { gateTemplate, mgCode, createMgOverlay, mgOverlayLayer, type MgTemplate } from '@cinegen/lib/occ/mg-templates';
import { normalizeOverlays } from '@cinegen/lib/overlays/overlays';

const pack = JSON.parse(fs.readFileSync('public/occ-templates/social-shorts-templates.json', 'utf8')) as Array<Record<string, unknown>>;

describe('motion-graphics templates on the sandboxed code renderer', () => {
  it('wraps an upstream template as Animation({ props }) and passes the code gate', () => {
    const code = String(pack[0].code);
    expect(mgCode(code)).toMatch(/function Animation\(\{ props \}\)/);
    expect(gateTemplate(code).ok).toBe(true);
  });
  it('the gate still rejects hostile template code', () => {
    expect(gateTemplate('const T = ({ item }) => { fetch("https://x"); return null; }').ok).toBe(false);
  });
  it('creates an overlay that persists and maps to a code layer', () => {
    const t = { ...pack[0], width: 1080, height: 1920, fps: 30, durationInFrames: 90, props: {}, propSchema: [], usable: true } as unknown as MgTemplate;
    const o = createMgOverlay(t, 2);
    expect(normalizeOverlays([o])).toHaveLength(1);
    const l = mgOverlayLayer(o, 30);
    expect(l).toMatchObject({ kind: 'code', from: 60, durationInFrames: 90 });
  });
});

describe('overlay-lane items reach the exported composition', () => {
  it('a call button and an End Screen background become composition layers; lead forms stay interactive-only', async () => {
    await import('../../lib/editor/addons/index.js');
    const { timelineToComposition } = await import('../../lib/editor/remotion/timelineToComposition.js');
    const { createTemplateOverlays } = await import('@cinegen/lib/overlays/overlays');
    const items = [...createTemplateOverlays('cf-call-now', 2, 30, { phone: '212 555 0147' }), ...createTemplateOverlays('es-thanks', 2, 30), ...createTemplateOverlays('cf-book-call', 2, 30)];
    const model = timelineToComposition({ timelineSeconds: 30, tracks: [{ id: 'ov', type: 'text', items }] }, { quality: '720p' });
    expect(model.layers.some((l: { type?: string }) => l.type === 'cta-button')).toBe(true);
    expect(model.layers.some((l: { type?: string }) => l.type === 'overlay-text')).toBe(true);
    expect(model.layers.some((l: { type?: string }) => l.type === 'lead-form')).toBe(false);
  });
});
