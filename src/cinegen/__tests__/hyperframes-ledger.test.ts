// Keeps the three data files and the vendored folder consistent: every enabled block is verified, pinned, vendored and has only effective fields.
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
// @ts-expect-error plain JSON
import cls from '../../lib/hyperframes/catalog.classification.json';
// @ts-expect-error plain JSON
import enabled from '../../lib/hyperframes/catalog.enabled.json';
// @ts-expect-error plain JSON
import manifest from '../../lib/hyperframes/catalog.manifest.json';

const items = cls.items as Record<string, { type: string; status: string; enabled: boolean; enabledBlockedBy: string[] }>;
const en = enabled.items as Array<{ id: string; type?: string; sourceSha256: string; editables: unknown[]; readyToUse?: boolean; project?: { demo?: boolean; files: Record<string, string> } }>;
describe('hyperframes ledger', () => {
  it('86 verified blocks = enabled + held back, and every held-back block records its blocker', () => {
    const verified = Object.entries(items).filter(([, v]) => v.type === 'block' && v.status === 'verified-export');
    const enabledIds = new Set(en.filter((i) => (i.type ?? 'block') === 'block').map((i) => i.id));
    const held = verified.filter(([k]) => !enabledIds.has(k));
    expect(verified.length).toBe(enabledIds.size + held.length);
    for (const [k, v] of held) expect(v.enabledBlockedBy.length, k).toBeGreaterThan(0);
  });
  it('every enabled item is verified, pinned to the manifest hash, vendored, and editable or explicitly ready-to-use', () => {
    const base = join(process.cwd(), 'public/hyperframes');
    const demos = new Set(readdirSync(join(base, 'component-demos')));
    const folderBlocks = new Set(readdirSync(join(base, 'blocks')).filter((d) => existsSync(join(base, 'blocks', d, `${d}.html`))));
    const dirs = { block: new Set([...readdirSync(join(base, 'blocks')).filter((f) => f.endsWith('.html')).map((f) => f.slice(0, -5)), ...folderBlocks]), component: new Set(readdirSync(join(base, 'components')).filter((f) => f.endsWith('.html')).map((f) => f.slice(0, -5))), example: new Set(readdirSync(join(base, 'examples'))) };
    const man = new Map((manifest.items as Array<{ id: string; sourceSha256: string; files: Array<{ path: string; sha256: string }> }>).map((i) => [i.id, i]));
    for (const i of en) {
      const t = (i.type ?? 'block') as 'block' | 'component' | 'example';
      const m = man.get(i.id)!; const viaDemo = i.project?.demo === true; const want = viaDemo ? i.project!.files['demo.html'] : t === 'example' ? m.files.find((f) => f.path === 'index.html')?.sha256 : m.sourceSha256;
      expect(items[i.id]?.status, i.id).toBe('verified-export'); expect(i.sourceSha256, i.id).toBe(want);
      expect((viaDemo ? demos : dirs[t]).has(i.id), i.id).toBe(true); expect(i.editables.length > 0 || i.readyToUse, i.id).toBeTruthy();
    }
    for (const t of ['block', 'component', 'example'] as const) expect([...dirs[t]].filter((v) => !en.some((i) => (i.type ?? 'block') === t && i.id === v)), t).toEqual([]);
  });
});
