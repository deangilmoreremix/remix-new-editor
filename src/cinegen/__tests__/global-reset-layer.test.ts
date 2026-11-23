// [remix] CineGen's universal reset must sit inside a cascade layer. Unlayered, `* { padding: 0 }` beats Tailwind's layered utilities
// everywhere in the app once the timeline stylesheet is loaded (the welcome API-keys modal lost its padding and its close button position).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(resolve(__dirname, '../styles/globals.css'), 'utf8');

describe('global reset', () => {
  it('is wrapped in @layer base', () => {
    const at = css.indexOf('*::after');
    expect(at).toBeGreaterThan(0);
    const before = css.slice(0, at);
    const open = before.lastIndexOf('@layer base {');
    expect(open).toBeGreaterThan(-1);
    // the block opened by @layer base must still be open at the reset (no closing brace at depth 0 between them)
    const between = before.slice(open + '@layer base {'.length);
    expect(between.includes('}')).toBe(false);
  });
});
