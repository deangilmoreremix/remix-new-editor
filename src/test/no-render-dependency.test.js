import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// The editor runs in the browser, on Netlify functions and on Supabase. Nothing
// in the app or its functions may call a Render.com service.
const ROOTS = ['src', 'netlify/functions'];
const EXT = /\.(js|jsx|ts|tsx|html|css|json)$/;
const SKIP_DIR = new Set(['node_modules', '__tests__', 'test', 'tests']);
const PATTERN = /onrender\.com|\brender\.com\b/i;

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) { if (!SKIP_DIR.has(entry.name)) yield* walk(path.join(dir, entry.name)); }
    else if (EXT.test(entry.name) && !/\.test\./.test(entry.name)) yield path.join(dir, entry.name);
  }
}

describe('no Render.com dependency', () => {
  it('has no Render URL in the app or the Netlify functions', () => {
    const hits = [];
    for (const root of ROOTS) {
      if (!fs.existsSync(root)) continue;
      for (const file of walk(root)) {
        const lines = fs.readFileSync(file, 'utf8').split('\n');
        lines.forEach((line, i) => { if (PATTERN.test(line)) hits.push(`${file}:${i + 1}: ${line.trim().slice(0, 120)}`); });
      }
    }
    expect(hits).toEqual([]);
  });
});
