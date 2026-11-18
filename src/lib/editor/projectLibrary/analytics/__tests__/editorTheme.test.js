import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../../../../../..');
const analyticsCss = readFileSync(resolve(root, 'styles/smartvideo-analytics.css'), 'utf8');
const panelCss = readFileSync(resolve(root, 'styles/projects-panel.css'), 'utf8');
const tokensCss = readFileSync(resolve(root, 'styles/timeline-tokens.css'), 'utf8');

// sha256 of the supplied SmartVideoAnalytics.css (smartvideo-analytics-ui.zip); the file must keep it as its exact prefix.
const SUPPLIED_BYTES = 6830;
const SUPPLIED_SHA256 = '08cf6d6b71cfd4f3a0088b0252574e643f1aa124e7100a3ab7427de5749cf4bf';
const prefixSha = createHash('sha256').update(Buffer.from(analyticsCss, 'utf8').subarray(0, SUPPLIED_BYTES)).digest('hex');
const block = analyticsCss.slice(analyticsCss.indexOf('/* ===== EDITOR THEME START'), analyticsCss.indexOf('/* ===== EDITOR THEME END ====='));
const hexes = (css) => [...css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0].toLowerCase());

describe('Analytics + Projects use the Timeline Editor palette', () => {
  it('keeps the supplied stylesheet as the exact, unmodified prefix', () => {
    expect(prefixSha).toBe(SUPPLIED_SHA256);
    expect(Buffer.from(analyticsCss, 'utf8').subarray(SUPPLIED_BYTES).toString('utf8')).toContain('EDITOR THEME START');
  });

  it('the editor theme block maps every supplied token onto editor tokens', () => {
    expect(block.length).toBeGreaterThan(500);
    for (const [sv, editor] of [['--sv-blue', '--cyan'], ['--sv-green', '--emerald'], ['--sv-panel', '--surface-1'], ['--sv-panel-soft', '--surface-3'], ['--sv-text', '--text'], ['--sv-muted', '--text-muted'], ['--sv-border', '--border'], ['--sv-grid', '--border-soft']]) {
      expect(block, sv).toContain(`${sv}:var(${editor})`);
    }
    for (const token of ['--accent-grad', '--cyan-soft', '--success-soft', '--success-text', '--shadow-focus', '--danger']) expect(block).toContain(`var(${token})`);
    for (const token of ['--cyan', '--emerald', '--accent-grad', '--cyan-soft', '--surface-1', '--surface-3', '--border', '--text', '--success-soft']) expect(tokensCss, token).toContain(`${token}:`);
  });

  it('never hard-codes an accent: edges and hovers are derived from the live --cyan token', () => {
    expect(block).not.toMatch(/rgba?\(\s*34\s*,\s*211\s*,\s*238/);          // the cyan the editor replaces with lime at runtime
    expect(block).not.toMatch(/rgba?\(\s*217\s*,\s*255\s*,\s*0/);            // ...and no literal lime either
    expect(block).toContain('color-mix(in srgb,var(--cyan) 45%,transparent)');
    expect(panelCss).not.toMatch(/rgba?\(\s*(34\s*,\s*211\s*,\s*238|217\s*,\s*255\s*,\s*0)/);
  });

  it('contains no hard-coded blue / slate / green: only the editor\'s own two literals', () => {
    // #03131a is the editor's text-on-accent colour (.primary-btn), #cffafe its active-button text (.tool-btn.active)
    expect([...new Set(hexes(block))].sort()).toEqual(['#03131a', '#cffafe']);
    for (const blue of ['#3b82f6', '#2563eb', '#93c5fd', '#192332', '#253143', '#111827', '#16a34a', '#134e34', '#9be6b5']) expect(block.toLowerCase()).not.toContain(blue);
  });

  it('the Projects panel stylesheet takes every colour from editor tokens (no brand colours of its own)', () => {
    const found = [...new Set(hexes(panelCss))];
    expect(found).toEqual(['#fff']);                       // white badge text on --danger
    expect(panelCss).not.toMatch(/#(134e34|9be6b5|3b82f6|2563eb|161b24|263041|9aa4b2)/i);
    expect(panelCss).toContain('.prj-chip.is-published{background:var(--success-soft)');
  });
});
