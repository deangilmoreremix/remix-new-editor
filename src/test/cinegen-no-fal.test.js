/**
 * The CineGen workspace mounted at #/timeline must not call fal (or the desktop-only providers it shipped with).
 * Walks static + dynamic imports from src/cinegen/mount.tsx, following the `@cinegen/` alias.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const ENTRY = 'src/cinegen/mount.tsx';
const SPEC = /(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)['"](@cinegen\/[^'"]+|\.{1,2}\/[^'"]+)['"]/g;
const FAL = /fal\.run|fal\.ai|['"]fal-ai\/|@fal-ai\/|FAL_KEY|queue\.fal|api\.topview\.ai|higgsfield\.ai|artlist\.io|api\.runpod\.ai/i;
const EXT = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '/index.ts', '/index.tsx', '/index.js'];

function resolve(fromFile, spec) {
  const base = spec.startsWith('@cinegen/')
    ? path.join(ROOT, 'src/cinegen', spec.slice(9))
    : path.resolve(path.dirname(path.join(ROOT, fromFile)), spec);
  for (const e of EXT) {
    const p = base + e;
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return path.relative(ROOT, p);
  }
  return null;
}

function reachable(entry) {
  const seen = new Set();
  const stack = [entry];
  while (stack.length) {
    const f = stack.pop();
    if (seen.has(f) || !/\.(m?js|jsx|ts|tsx)$/.test(f)) continue;
    seen.add(f);
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const m of src.matchAll(SPEC)) {
      const r = resolve(f, m[1]);
      if (r && !r.includes('node_modules')) stack.push(r);
    }
  }
  return [...seen];
}

describe('CineGen workspace uses no fal', () => {
  it('no reachable module calls fal / Topview / Higgsfield / Artlist / RunPod', () => {
    const files = reachable(ENTRY);
    expect(files.length).toBeGreaterThan(100);
    const offenders = files.filter((f) => FAL.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
    expect(offenders).toEqual([]);
  });
});
