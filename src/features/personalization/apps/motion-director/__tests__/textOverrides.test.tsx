// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { applyTextOverrides, parseTextMap } from '../lib/textOverrides';
import { DEMO_TEXTS } from '../demosrc/_generated/demoTexts';
import { MOTION_TEMPLATES } from '../../../data/motionRecipeCatalog';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const html = (h: string) => {
  const el = document.createElement('div');
  el.innerHTML = h;
  return el;
};

describe('text overrides', () => {
  it('replaces whole nodes (any case / spacing), keeps the surrounding space, and leaves others alone', () => {
    const el = html('<h1>  Every shot,  within reach. </h1><p>Home</p>');
    applyTextOverrides(el, { 'every shot, within reach.': 'Your IT, handled.' });
    expect(el.querySelector('h1')!.textContent).toBe('  Your IT, handled. ');
    expect(el.querySelector('p')!.textContent).toBe('Home');
  });

  it('replaces a longer phrase inside a bigger node', () => {
    const el = html('<p>Part of Launch film brief for the team</p>');
    applyTextOverrides(el, { 'Launch film brief': 'Acme plan' });
    expect(el.textContent).toBe('Part of Acme plan for the team');
  });

  it('spreads a replacement over per-letter elements', () => {
    const el = html('<div><span>S</span><span>C</span><span>A</span><span>L</span><span>E</span></div>');
    applyTextOverrides(el, { SCALE: 'GROW' });
    expect(Array.from(el.querySelectorAll('span')).map((s) => s.textContent)).toEqual(['G', 'R', 'O', 'W', '']);
    const el2 = html('<div><span>H</span><span>I</span></div>');
    applyTextOverrides(el2, { HI: 'HELLO' });
    expect(el2.textContent).toBe('HELLO');
  });

  it('hands new words out over a phrase drawn in pieces', () => {
    const el = html('<h1><span>Every shot,</span><br><span>within reach.</span></h1>');
    applyTextOverrides(el, { 'Every shot, within reach.': 'Finally, a cure for your IT headaches' });
    expect(el.textContent!.replace(/\s+/g, ' ').trim()).toBe('Finally, a cure for your IT headaches');
    expect(el.querySelectorAll('span')).toHaveLength(2);
  });

  it('is idempotent and ignores empty or unchanged entries', () => {
    const el = html('<p>Renders</p>');
    const map = parseTextMap({ Renders: 'Invoices', Shots: '', Same: 'same' });
    expect(map).toEqual({ Renders: 'Invoices' });
    applyTextOverrides(el, map);
    applyTextOverrides(el, map);
    expect(el.textContent).toBe('Invoices');
    expect(parseTextMap('{"a b":"c"}')).toEqual({ 'a b': 'c' });
    expect(parseTextMap('nope')).toEqual({});
  });

  it('survives React re-rendering a changing value (re-applied after each commit)', async () => {
    const Demo: React.FC<{ n: number }> = ({ n }) => <p>{n % 2 ? 'Home' : 'Home '}</p>;
    const Wrapped: React.FC<{ n: number }> = ({ n }) => {
      const ref = React.useRef<HTMLDivElement>(null);
      React.useLayoutEffect(() => {
        if (ref.current) applyTextOverrides(ref.current, { Home: 'Start' });
      });
      return <div ref={ref}><Demo n={n} /></div>;
    };
    const host = document.createElement('div');
    const root = createRoot(host);
    await act(async () => root.render(<Wrapped n={1} />));
    expect(host.textContent).toBe('Start');
    await act(async () => root.render(<Wrapped n={2} />));
    expect(host.textContent!.trim()).toBe('Start');
  });
});

describe('demo text manifest', () => {
  it('lists words for most recipes, without CSS noise', () => {
    const withWords = MOTION_TEMPLATES.filter((t) => (DEMO_TEXTS[t.componentName] ?? []).length > 0);
    expect(withWords.length).toBeGreaterThan(MOTION_TEMPLATES.length * 0.7);
    const all = Object.values(DEMO_TEXTS).flat();
    expect(all.filter((s) => /rgba?\(|#[0-9a-f]{6}|\d+px|gradient/i.test(s))).toEqual([]);
    expect(DEMO_TEXTS.ListReveal).toContain('Every shot, within reach.');
  });
});
