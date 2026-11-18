// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { findHelp, place } from '../tooltipLayer.js';
import { resolveStudioHelp, helpKey, STUDIO_HELP } from '../../../lib/help/studioHelp.js';

describe('studioHelp', () => {
  it('normalizes labels (case, shortcut suffix, trailing ellipsis)', () => {
    expect(helpKey('Generate (Ctrl+Enter)')).toBe('generate');
    expect(helpKey('  Advanced… ')).toBe('advanced');
    expect(resolveStudioHelp('Aspect  Ratio')?.name).toBe('Aspect Ratio');
  });
  it('returns null for unknown labels', () => {
    expect(resolveStudioHelp('Totally unknown control')).toBeNull();
  });
  it('every entry has a name and keys are already normalized', () => {
    for (const [key, entry] of Object.entries(STUDIO_HELP)) {
      expect(entry.name, key).toBeTruthy();
      expect(helpKey(key), key).toBe(key);
    }
  });
});

describe('findHelp', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('resolves copy from aria-label', () => {
    document.body.innerHTML = '<button aria-label="Seed"><svg></svg></button>';
    const hit = findHelp(document.querySelector('svg')?.parentElement);
    expect(hit?.entry.name).toBe('Seed');
  });

  it('prefers data-help over other attributes', () => {
    document.body.innerHTML = '<button data-help="negative prompt" title="x">?</button>';
    expect(findHelp(document.querySelector('button'))?.entry.name).toBe('Negative Prompt');
  });

  it('themes a plain data-tooltip / title when there is no copy', () => {
    document.body.innerHTML = '<button data-tooltip="Custom hint">?</button>';
    expect(findHelp(document.querySelector('button'))?.entry).toEqual({ name: 'Custom hint' });
  });

  it('does not use aria-label alone as a plain tooltip', () => {
    document.body.innerHTML = '<button aria-label="Close dialog">x</button>';
    expect(findHelp(document.querySelector('button'))).toBeNull();
  });

  it('skips the Timeline Editor, which has its own help layer', () => {
    document.body.innerHTML = '<div class="cinegen-root"><button aria-label="Seed">s</button></div>';
    expect(findHelp(document.querySelector('button'))).toBeNull();
  });
});

describe('place', () => {
  const rect = (o) => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, ...o });
  it('opens below a wide control when there is room', () => {
    const p = place(rect({ left: 100, right: 300, top: 50, bottom: 90, width: 200, height: 40 }), 200, 60, 1000, 800);
    expect(p.top).toBe(100);
  });
  it('flips above near the bottom edge', () => {
    const p = place(rect({ left: 100, right: 300, top: 740, bottom: 780, width: 200, height: 40 }), 200, 60, 1000, 800);
    expect(p.top).toBe(670);
  });
  it('opens beside small icon controls', () => {
    const p = place(rect({ left: 10, right: 42, top: 100, bottom: 132, width: 32, height: 32 }), 200, 60, 1000, 800);
    expect(p.left).toBe(52);
  });
  it('clamps inside the viewport horizontally', () => {
    const p = place(rect({ left: 950, right: 1000, top: 50, bottom: 90, width: 50, height: 40 }), 300, 60, 1000, 800);
    expect(p.left + 300).toBeLessThanOrEqual(990);
  });
});
