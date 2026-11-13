// Imported template repos share the animation overlay: catalog, verification, vendored source, thumbnails and the overlay mapping must agree.
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
// @ts-expect-error plain JSON
import catalog from '../../lib/templates/catalog.json';
// @ts-expect-error plain JSON
import lock from '../../lib/templates/lock.json';
// @ts-expect-error plain JSON
import ver from '../../lib/templates/verification.json';
import { hyperframesItem, hyperframesItems, createHyperframesOverlay, hyperframesOverlayLayer, overridesFromProps } from '../lib/hyperframes/overlay';

type Item = { id: string; repo: string; name: string; enabled: boolean; reason: string; editables: Array<{ key: string; defaultValue: unknown }> };
const items = catalog.items as Item[]; const root = process.cwd();
describe('imported templates ledger', () => {
  it('has the three pinned MIT repositories and every non-enabled template records a reason', () => {
    expect(Object.keys(lock.repos).sort()).toEqual(['free', 'rve', 'video']);
    for (const r of Object.values(lock.repos) as Array<{ commit: string; license: string }>) { expect(r.commit).toMatch(/^[0-9a-f]{40}$/); expect(r.license).toMatch(/MIT/); }
    expect(items.length).toBe(138);
    for (const i of items.filter((x) => !x.enabled)) expect(i.reason.length, i.id).toBeGreaterThan(3);
  });
  it('every enabled template was verified and has a loader and a thumbnail; every vendored file is hashed', () => {
    const loaders = readFileSync(join(root, 'src/lib/editor/remotion/templates/loaders.generated.js'), 'utf8');
    for (const i of items.filter((x) => x.enabled)) {
      expect(ver[i.id]?.enabled, i.id).toBe(true); expect(loaders.includes(`'${i.id}'`), i.id).toBe(true);
      expect(existsSync(join(root, `public/hyperframes/thumbs/${i.id.replace(/:/g, '-')}.jpg`)), i.id).toBe(true);
    }
    for (const [repo, files] of Object.entries(lock.files as Record<string, Record<string, string>>)) for (const h of Object.values(files)) expect(h, repo).toMatch(/^[0-9a-f]{64}$/);
  });
});
describe('templates in the animation overlay', () => {
  it('only enabled templates are offered for adding, and every one still resolves for saved projects', () => {
    expect(hyperframesItems().filter((i) => i.id.startsWith('tpl:')).length).toBe(items.filter((i) => i.enabled).length);
    for (const i of items) expect(hyperframesItem(i.id)?.id).toBe(i.id);
  });
  it('maps edited fields straight to the component (typed props) or to a text slot', () => {
    const typed = items.find((i) => i.id === 'tpl:free:lower-third-glass-card')!; const item = hyperframesItem(typed.id)!;
    const o = createHyperframesOverlay(item, 0);
    expect(overridesFromProps(item, o.props as Record<string, unknown>)).toEqual({});
    expect(overridesFromProps(item, { ...o.props, nameText: 'Sam Lee' })).toEqual({ nameText: 'Sam Lee' });
    const layer = hyperframesOverlayLayer({ ...o, props: { ...o.props, nameText: 'Sam Lee' } }, 30) as { blockId: string; overrides: Record<string, unknown> };
    expect(layer).toMatchObject({ blockId: typed.id, overrides: { nameText: 'Sam Lee' } });
    const slot = items.find((i) => i.repo === 'rve' && i.enabled && i.editables.some((e) => e.key === 't1'))!; const si = hyperframesItem(slot.id)!;
    expect(overridesFromProps(si, { t1: 'Hello' })).toEqual({ t1: 'Hello' });
  });
});
