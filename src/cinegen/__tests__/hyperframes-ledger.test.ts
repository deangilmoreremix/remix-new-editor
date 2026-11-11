// Keeps the three data files and the vendored folder consistent: every enabled block is verified, pinned, vendored and has only effective fields.
import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
// @ts-expect-error plain JSON
import cls from '../../lib/hyperframes/catalog.classification.json';
// @ts-expect-error plain JSON
import enabled from '../../lib/hyperframes/catalog.enabled.json';
// @ts-expect-error plain JSON
import manifest from '../../lib/hyperframes/catalog.manifest.json';

const items = cls.items as Record<string, { type: string; status: string; enabled: boolean; enabledBlockedBy: string[] }>;
const en = enabled.items as Array<{ id: string; sourceSha256: string; editables: unknown[]; readyToUse?: boolean }>;
describe('hyperframes ledger', () => {
  it('86 verified blocks = enabled + held back, and every held-back block records its blocker', () => {
    const verified = Object.entries(items).filter(([, v]) => v.type === 'block' && v.status === 'verified-export');
    const enabledIds = new Set(en.map((i) => i.id));
    const held = verified.filter(([k]) => !enabledIds.has(k));
    expect(verified.length).toBe(enabledIds.size + held.length);
    for (const [k, v] of held) expect(v.enabledBlockedBy.length, k).toBeGreaterThan(0);
  });
  it('every enabled block is verified, pinned to the manifest hash, vendored, and editable or explicitly ready-to-use', () => {
    const vendored = new Set(readdirSync(join(process.cwd(), 'public/hyperframes/blocks')).filter((f) => f.endsWith('.html')).map((f) => f.slice(0, -5)));
    const man = new Map((manifest.items as Array<{ id: string; sourceSha256: string }>).map((i) => [i.id, i.sourceSha256]));
    for (const i of en) {
      expect(items[i.id]?.status, i.id).toBe('verified-export'); expect(i.sourceSha256, i.id).toBe(man.get(i.id));
      expect(vendored.has(i.id), i.id).toBe(true); expect(i.editables.length > 0 || i.readyToUse, i.id).toBeTruthy();
    }
    expect([...vendored].filter((v) => !en.some((i) => i.id === v))).toEqual([]);
  });
});
