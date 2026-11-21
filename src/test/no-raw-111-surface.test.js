// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// The dark panel/surface colour #111 was written as a raw Tailwind value (bg-[#111], also /80 and /90) in dozens of files. It is the theme's
// card-bg token now (src/styles/global.css), which is what the Cinema colour check asks for. This keeps the raw value out of src.
const RAW = /bg-\[#111\]/;
const TEXT = /\.(js|jsx|ts|tsx|css|html)$/;
const SELF = 'src/test/no-raw-111-surface.test.js';
// Protected application files are checked byte for byte (src/test/protected-upload-baseline.test.ts): any edit, even a colour, fails that guard. They keep the raw value.
const PROTECTED = new Set(['src/components/ChatStudio.js']);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

describe('no raw #111 surface colour in src', () => {
  it('uses the card-bg theme token instead', () => {
    const root = process.cwd();
    const hits = [];
    for (const file of walk(join(root, 'src'))) {
      const rel = relative(root, file);
      if (rel === SELF || PROTECTED.has(rel) || !TEXT.test(file) || statSync(file).size > 3_000_000) continue;
      if (RAW.test(readFileSync(file, 'utf8'))) hits.push(rel);
    }
    expect(hits).toEqual([]);
  });
});
