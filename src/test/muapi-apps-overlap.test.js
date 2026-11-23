import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import appsMap from '../data/muapiStudioAppsMap.json';

// vitest runs from the repo root (import.meta.url is not a file URL under jsdom).
const root = `${process.cwd()}/`;

describe('muapi apps overlap with existing studios', () => {
  it('marks every app new, similar or duplicate', () => {
    expect(appsMap.apps).toHaveLength(78);
    for (const a of appsMap.apps) {
      expect(['new', 'similar', 'duplicate'], a.id).toContain(a.overlap);
      if (a.overlap === 'new') expect(a.existingIn, a.id).toBeUndefined();
      else expect(a.existingIn?.length, a.id).toBeGreaterThan(0);
    }
  });

  it('keeps the overlap level consistent with its matches', () => {
    for (const a of appsMap.apps.filter((x) => x.existingIn)) {
      const strong = a.existingIn.some((x) => x.match !== 'similar');
      expect(a.overlap, a.id).toBe(strong ? 'duplicate' : 'similar');
    }
  });

  it('every remix-new-editor file it points at still exists and contains the named item', () => {
    for (const a of appsMap.apps) {
      for (const x of a.existingIn ?? []) {
        if (x.repo !== 'remix-new-editor') continue; // other repos are checked by the generator when checked out
        const p = root + x.file;
        expect(existsSync(p), `${a.id}: ${x.file}`).toBe(true);
        expect(readFileSync(p, 'utf8').toLowerCase().includes(x.item.toLowerCase()), `${a.id}: "${x.item}" in ${x.file}`).toBe(true);
      }
    }
  });

  it('records the known duplicates', () => {
    const dup = appsMap.apps.filter((a) => a.overlap === 'duplicate').map((a) => a.id);
    expect(dup).toEqual(expect.arrayContaining(['skin-enhancer', 'face-swap', 'expand-image', 'recast', 'relight', 'color-grading']));
  });
});
