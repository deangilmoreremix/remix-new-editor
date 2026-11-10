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
