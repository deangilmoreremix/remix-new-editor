import { describe, expect, it } from 'vitest';
import { checkAdaptedSource, compileAdapted } from '../lib/shotAdapter';

const GOOD = `
import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
export const DURATION = 60;
export default function Shot(props) {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  return <AbsoluteFill style={{ opacity: o, background: '#111' }}><img src={props.screens?.[0]} /></AbsoluteFill>;
}`;

const bad = async (code: string) => (await checkAdaptedSource(code)).error;

describe('adapted shot sandbox', () => {
  it('accepts a plain Remotion component', async () => {
    expect((await checkAdaptedSource(GOOD)).ok).toBe(true);
  });

  it('refuses imports outside react / remotion / the fixtures', async () => {
    expect(await bad(`import fs from 'fs'; export default () => null`)).toMatch(/import not allowed/);
    expect(await bad(`import x from 'https://evil/x.js'; export default () => null`)).toMatch(/import not allowed/);
    expect((await checkAdaptedSource(`import { Card } from '../../_fixtures/Fixtures'; export default () => <Card />`)).ok).toBe(true);
    expect(await bad(`import x from '../../_fixtures/Secret'; export default () => null`)).toMatch(/import not allowed/);
  });

  it('refuses network, storage, DOM globals and escape hatches', async () => {
    for (const body of [
      `fetch('/x')`, `new XMLHttpRequest()`, `localStorage.getItem('a')`, `document.cookie`, `window.top`, `eval('1')`,
      `new Function('return 1')`, `({}).constructor.constructor('x')`, `setTimeout(() => 1, 5)`, `globalThis.x`, `import('x')`,
      `const o = {}; o['constructor']`,
    ]) {
      expect(await bad(`export default function A() { ${body}; return null }`), body).toBeTruthy();
    }
  });

  it('refuses nondeterminism', async () => {
    expect(await bad(`export default function A() { return <div>{Math.random()}</div> }`)).toMatch(/non-deterministic/);
    expect(await bad(`export default function A() { return <div>{Date.now()}</div> }`)).toMatch(/non-deterministic/);
    expect(await bad(`export default function A() { return <div>{String(new Date())}</div> }`)).toMatch(/non-deterministic/);
  });

  it('refuses external URLs, script tags and raw HTML', async () => {
    expect(await bad(`export default () => <img src="https://evil.example/p.png" />`)).toMatch(/external URLs/);
    expect(await bad(`export default () => <div style={{ background: 'url(//evil.example/x)' }} />`)).toMatch(/external URLs/);
    expect(await bad(`export default () => <script />`)).toMatch(/not allowed/);
    expect(await bad(`export default () => <iframe />`)).toMatch(/not allowed/);
    expect(await bad(`export default () => <div dangerouslySetInnerHTML={{ __html: 'x' }} />`)).toMatch(/not allowed/);
  });

  it('refuses a file with no default component and a syntax error', async () => {
    expect(await bad(`export const a = 1`)).toMatch(/export/);
    expect(await bad(`export default function A( {`)).toMatch(/syntax/);
  });

  it('compiles an accepted component and refuses a rejected one', async () => {
    const C = await compileAdapted(GOOD);
    expect(typeof C).toBe('function');
    await expect(compileAdapted(`export default () => fetch('/x')`)).rejects.toThrow(/not allowed/);
  });
});
