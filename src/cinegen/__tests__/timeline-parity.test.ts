// [remix] Keeps the timeline editor close to CineGen's own code: each timeline file may differ from the vendored, unmodified copy in
// apps/cinegen/src (after the @cinegen/ -> @/ alias) by at most the budget below. Raise a budget only on purpose (and mark the edit [remix]).
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const BUDGET: Record<string, number> = {
  'components/edit/time-ruler.tsx': 0,
  'components/edit/track-row.tsx': 10,
  'components/edit/clip-card.tsx': 40,
  'components/edit/tool-sidebar.tsx': 30,
  'components/edit/left-panel.tsx': 60,
  'components/edit/timeline-viewer.tsx': 70,
  'components/edit/timeline-editor.tsx': 220,
  'components/edit/edit-tab.tsx': 260,
  'lib/editor/playback-engine.ts': 80,
};

function changedLines(a: string[], b: string[]): number {
  // simple LCS-free estimate: lines present on one side only (multiset difference), enough to catch drift
  const count = new Map<string, number>();
  for (const l of a) count.set(l, (count.get(l) ?? 0) + 1);
  let common = 0;
  for (const l of b) { const n = count.get(l) ?? 0; if (n > 0) { common++; count.set(l, n - 1); } }
  return (a.length - common) + (b.length - common);
}

describe('timeline files stay close to CineGen', () => {
  const ref = join(root, 'apps/cinegen/src');
  for (const [file, budget] of Object.entries(BUDGET)) {
    it(`${file} differs by at most ${budget} lines`, () => {
      const refPath = join(ref, file);
      if (!existsSync(refPath)) return; // vendored copy not present in this checkout
      const ours = readFileSync(join(root, 'src/cinegen', file), 'utf8').replace(/@cinegen\//g, '@/').split('\n');
      const theirs = readFileSync(refPath, 'utf8').split('\n');
      expect(changedLines(ours, theirs)).toBeLessThanOrEqual(budget);
    });
  }
});
