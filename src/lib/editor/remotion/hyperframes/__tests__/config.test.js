import { describe, it, expect } from 'vitest';
import { patchConfig, findConfigLiteral, isCfgKey, configLeaves } from '../config.js';
import { validateOverrides } from '../security.js';

const run = (code) => new Function(`${code}\nreturn CONFIG;`)();
const SRC = `var CONFIG = {
  text: "hello { world } // not a comment", /* } */
  fontSize: 120, scheme: "chalk", // "chalk" | "ink"
  sweep: { enabled: true, start: 0.8 }, x: null,
};
var after = 1;`;

describe('CONFIG overrides', () => {
  it('finds the literal despite braces in strings and comments', () => {
    const r = findConfigLiteral(SRC); expect(SRC.slice(r[0], r[1]).endsWith('}')).toBe(true); expect(SRC.slice(r[1], r[1] + 2)).toBe(';\n');
  });
  it('replaces only existing leaves of the same type', () => {
    const c = run(patchConfig(SRC, { 'cfg.text': 'Acme', 'cfg.fontSize': 80, 'cfg.sweep.enabled': false, 'cfg.sweep.start': 'bad', 'cfg.nope': 1, 'cfg.x': 5 }));
    expect(c.text).toBe('Acme'); expect(c.fontSize).toBe(80); expect(c.sweep.enabled).toBe(false); expect(c.sweep.start).toBe(0.8); expect(c.nope).toBeUndefined(); expect(c.x).toBe(null);
  });
  it('is not a code-injection channel and cannot pollute prototypes', () => {
    const c = run(patchConfig(SRC, { 'cfg.text': '"});globalThis.__pwn=1;({"', 'cfg.__proto__.polluted': 'x' }));
    expect(c.text).toBe('"});globalThis.__pwn=1;({"'); expect(globalThis.__pwn).toBeUndefined(); expect({}.polluted).toBeUndefined();
  });
  it('is validated: bad paths, huge numbers, objects', () => {
    expect(isCfgKey('cfg.a.b')).toBe(true); expect(isCfgKey('cfg.__proto__')).toBe(false); expect(isCfgKey('cfg.a b')).toBe(false);
    const v = validateOverrides({ 'cfg.text': 'ok', 'cfg.n': 1e9, 'cfg.o': { a: 1 }, 'cfg.constructor.x': 1, 'cfg.b': true });
    expect(Object.keys(v.cleaned).sort()).toEqual(['cfg.b', 'cfg.text']); expect(v.rejected.length).toBe(3);
  });
  it('returns null when the script has no CONFIG', () => { expect(patchConfig('var a=1;', { 'cfg.x': 1 })).toBeNull(); });
  it('lists leaves', () => { expect(configLeaves(run(SRC)).map((l) => l[0])).toEqual(['text', 'fontSize', 'scheme', 'sweep.enabled', 'sweep.start']); });
});
