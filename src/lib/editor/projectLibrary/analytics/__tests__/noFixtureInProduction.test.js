import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(__dirname, '../../../../../..');
const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  if (f === 'node_modules' || f === '__tests__' || f === 'dist') return [];
  return statSync(p).isDirectory() ? walk(p) : [p];
});

describe('analytics UI never ships demo data', () => {
  it('no production module imports the supplied fixture or references demoAnalytics', () => {
    const offenders = walk(join(root, 'src')).concat(walk(join(root, 'netlify'))).filter((f) => /\.(jsx?|tsx?|mjs|cjs)$/.test(f))
      .filter((f) => /supplied-fixture|demoAnalytics|demo-kitchen|smartvid\.app\/v\/example\/kitchen-renovation/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
  it('the component file itself contains no hard-coded metrics', () => {
    const src = readFileSync(join(root, 'src/lib/editor/projectLibrary/analytics/SmartVideoAnalytics.tsx'), 'utf8');
    expect(src).not.toMatch(/1248|5132|13780|Kitchen Renovation Promo/);
  });
  it('the fixture exists only inside a __tests__ directory', () => {
    // walk() skips __tests__, so any hit here is a fixture outside a test directory.
    const all = walk(join(root, 'src/lib/editor/projectLibrary'));
    expect(all.filter((f) => /fixture/i.test(f))).toEqual([]);
  });
});
