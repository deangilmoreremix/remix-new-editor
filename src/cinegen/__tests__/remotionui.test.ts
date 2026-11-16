// RemotionUI items share the animation overlay: catalog, verification, vendored source, thumbnails and the overlay mapping must agree.
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
// @ts-expect-error plain JSON
import catalog from '../../lib/remotionui/catalog.json';
// @ts-expect-error plain JSON
import lock from '../../lib/remotionui/registry.lock.json';
// @ts-expect-error plain JSON
import ver from '../../lib/remotionui/verification.json';
import { hyperframesItem, hyperframesItems, createHyperframesOverlay, hyperframesOverlayLayer, overridesFromProps } from '../lib/hyperframes/overlay';

type Item = { id: string; name: string; enabled: boolean; reason: string; needs: string[]; editables: Array<{ key: string; defaultValue: unknown }>; category: string };
const items = catalog.items as Item[];
const root = process.cwd();
describe('remotionui ledger', () => {
  it('lists all 217 components and records why each non-enabled one is not enabled', () => {
    expect(items.length).toBe(217);
    for (const i of items.filter((x) => !x.enabled)) expect(i.reason.length, i.id).toBeGreaterThan(3);
  });
  it('every enabled item was verified, has a loader, a demo, a thumbnail and pinned vendored source', () => {
    const loaders = readFileSync(join(root, 'src/lib/editor/remotion/remotionui/loaders.generated.js'), 'utf8');
    const pinned = new Map((lock.items as Array<{ name: string; files: Array<{ path: string; sha256: string }> }>).map((i) => [i.name, i]));
    for (const i of items.filter((x) => x.enabled)) {
      expect(ver[i.name]?.enabled, i.id).toBe(true);
      expect(loaders.includes(`'${i.id}'`), i.id).toBe(true);
      expect(existsSync(join(root, `src/lib/editor/remotion/remotionui/demos/${i.name}.jsx`)), i.id).toBe(true);
      expect(existsSync(join(root, `public/hyperframes/thumbs/rui-${i.name}.jpg`)), i.id).toBe(true);
      expect(i.needs.length, i.id).toBe(0);
      for (const f of pinned.get(i.name)!.files) { expect(existsSync(join(root, f.path)), f.path).toBe(true); expect(f.sha256).toMatch(/^[0-9a-f]{64}$/); }
    }
  });
});
describe('remotionui in the animation overlay', () => {
  it('only enabled items are offered for adding, and every item still resolves for saved projects', () => {
    const offered = hyperframesItems().filter((i) => i.id.startsWith('rui:'));
    expect(offered.length).toBe(items.filter((i) => i.enabled).length);
    for (const i of items) expect(hyperframesItem(i.id)?.id).toBe(i.id);
  });
  it('maps edited props straight onto the component and leaves unchanged ones out', () => {
    const item = hyperframesItem('rui:lower-third')!;
    const o = createHyperframesOverlay(item, 2);
    expect(overridesFromProps(item, o.props as Record<string, unknown>)).toEqual({});
    expect(overridesFromProps(item, { ...o.props, title: 'Acme' })).toEqual({ title: 'Acme' });
    const layer = hyperframesOverlayLayer({ ...o, props: { ...o.props, title: 'Acme' } }, 30) as { kind: string; blockId: string; overrides: Record<string, unknown>; from: number };
    expect(layer).toMatchObject({ kind: 'hyperframes', blockId: 'rui:lower-third', overrides: { title: 'Acme' }, from: 60 });
  });
});
