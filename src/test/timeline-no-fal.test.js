/**
 * The Timeline Editor must not use fal: paid generation goes through MuAPI and
 * masking/segmentation runs in the browser. This walks the editor's static and
 * dynamic imports from TimelineEditorPage.jsx and fails if any reachable
 * module calls fal.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const ENTRY = 'src/components/TimelineEditorPage.jsx';
const SPEC = /(?:\bfrom\s+|\bimport\s*\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g;
const FAL = /fal\.run|fal\.ai\/|['"]fal-ai\/|@fal-ai\/|FAL_KEY|queue\.fal/;

function resolve(fromFile, spec) {
  const base = path.resolve(path.dirname(path.join(ROOT, fromFile)), spec);
  for (const p of [base, `${base}.js`, `${base}.jsx`, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.js')]) {
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

describe('Timeline Editor uses no fal', () => {
  it('no module reachable from the Timeline Editor calls fal', () => {
    const files = reachable(ENTRY);
    expect(files.length).toBeGreaterThan(50);
    const offenders = files.filter((f) => FAL.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('the timeline AI functions call MuAPI only', () => {
    for (const f of ['netlify/functions/cinegen.js', 'netlify/functions/cinegenProviders.js', 'netlify/functions/timeline-ai.js']) {
      expect(FAL.test(fs.readFileSync(path.join(ROOT, f), 'utf8')), f).toBe(false);
    }
    expect(fs.existsSync(path.join(ROOT, 'netlify/functions/providers/falSam3.js'))).toBe(false);
  });

  it('Fill Gap shortcuts no longer use the undefined GAP_FILL constant', () => {
    expect(fs.readFileSync(path.join(ROOT, ENTRY), 'utf8')).not.toMatch(/CINEGEN_TOOLS\.GAP_FILL/);
  });
});
