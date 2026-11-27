// [remix] CineGen's global resets must sit inside a cascade layer. Unlayered, `* { padding: 0 }`, `button { all: unset }` and the
// input rule beat Tailwind's layered utilities everywhere in the app once the timeline stylesheet is loaded (the welcome API-keys
// modal lost its padding, its close button position, its button styles and its rounded inputs).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(resolve(__dirname, '../styles/globals.css'), 'utf8');

/** True when the character at `index` is inside an `@layer base { ... }` block. */
function insideBaseLayer(index: number): boolean {
  const stack: boolean[] = [];
  for (let i = 0; i < index; i++) {
    if (css[i] === '{') {
      const head = css.slice(Math.max(0, i - 40), i);
      stack.push(/@layer\s+base\s*$/.test(head));
    } else if (css[i] === '}') stack.pop();
  }
  return stack.some(Boolean);
}

describe('global resets', () => {
  it('puts the universal reset in @layer base', () => {
    const at = css.indexOf('*::after');
    expect(at).toBeGreaterThan(0);
    expect(insideBaseLayer(at)).toBe(true);
  });

  it('puts `button { all: unset }` in @layer base', () => {
    const at = css.indexOf('all: unset;');
    expect(at).toBeGreaterThan(0);
    expect(insideBaseLayer(at)).toBe(true);
  });

  it('puts the input / textarea / select defaults in @layer base', () => {
    const at = css.indexOf('padding: 8px 12px;');
    expect(at).toBeGreaterThan(0);
    expect(insideBaseLayer(at)).toBe(true);
  });
});
